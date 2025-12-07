/**
 * Best-of-N Agent - Parallel Generation + Selection
 *
 * Spawns N instances of an agent in parallel, collects results,
 * and selects the best one using LLM evaluation.
 */

import { z } from 'zod'
import { defineAgent, type AgentContext, type AgentResult } from './types'
import { executeAgent, getAgent } from './registry'
import { streamChat, type Message } from '../services/openrouter'

const bestOfNParams = z.object({
  agent: z.string().describe('Target agent to spawn (e.g., "editor", "commander")'),
  params: z.record(z.unknown()).describe('Parameters to pass to each agent instance'),
  n: z.number().min(2).max(5).default(3).describe('Number of parallel instances (2-5)'),
  prompt: z.string().optional().describe('Task description for evaluation context'),
  criteria: z.array(z.string()).optional().describe('Custom evaluation criteria'),
})

const EVALUATION_SYSTEM_PROMPT = `You are a solution evaluator. Given multiple candidate outputs from the same task, you must:

1. Compare each candidate's output
2. Evaluate against the criteria
3. Select the best one

Output ONLY valid JSON in this exact format:
{
  "winner": 0,
  "justification": "brief explanation of why this candidate is best",
  "scores": [
    { "index": 0, "score": 8, "notes": "brief notes" },
    { "index": 1, "score": 6, "notes": "brief notes" }
  ]
}

The "winner" field must be the index (0-based) of the best candidate.`

export const bestOfNAgent = defineAgent({
  name: 'best_of_n',
  description: 'Spawn N instances of an agent in parallel and select the best result.',

  systemPrompt: EVALUATION_SYSTEM_PROMPT,

  parameters: bestOfNParams,

  async execute(params, context: AgentContext): Promise<AgentResult> {
    const { agent: agentName, params: agentParams, n, prompt, criteria } = params

    // Validate target agent exists
    const targetAgent = getAgent(agentName)
    if (!targetAgent) {
      return {
        success: false,
        summary: `Unknown agent: ${agentName}`,
      }
    }

    // Spawn N instances in parallel
    const results = await Promise.all(
      Array(n)
        .fill(null)
        .map(() => executeAgent(agentName, agentParams, context))
    )

    // Count successes
    const successful = results.filter(r => r.success)

    if (successful.length === 0) {
      return {
        success: false,
        summary: `All ${n} instances failed`,
        data: { allResults: results },
      }
    }

    if (successful.length === 1) {
      const winnerIndex = results.findIndex(r => r.success)
      return {
        success: true,
        summary: `Only 1/${n} succeeded, returning it`,
        data: {
          winner: {
            index: winnerIndex,
            result: successful[0],
            justification: 'Only successful result',
          },
          allResults: results,
        },
      }
    }

    // Multiple successes - use LLM to evaluate
    const criteriaText = criteria?.length
      ? `Evaluation criteria:\n${criteria.map(c => `- ${c}`).join('\n')}`
      : 'Evaluate for correctness, completeness, and quality.'

    const candidatesText = results
      .map((r, i) => {
        const status = r.success ? 'SUCCESS' : 'FAILED'
        const content = r.success ? (r.data ? JSON.stringify(r.data, null, 2) : r.summary) : r.summary
        return `=== Candidate ${i} [${status}] ===\n${content}`
      })
      .join('\n\n')

    const evaluationPrompt = `Task: ${prompt || 'Compare the outputs'}

${criteriaText}

${candidatesText}

Select the best candidate and output JSON.`

    try {
      // Call LLM for evaluation
      let fullResponse = ''
      const messages: Message[] = [
        { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
        { role: 'user', content: evaluationPrompt },
      ]

      await streamChat(
        messages,
        { onChunk: (chunk) => { fullResponse += chunk } },
        'anthropic/claude-3.5-haiku',
        undefined,
        false // no tools needed for evaluation
      )

      // Parse JSON response
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON in response')
      }

      const evaluation = JSON.parse(jsonMatch[0]) as {
        winner: number
        justification: string
        scores?: Array<{ index: number; score: number; notes: string }>
      }

      const winnerIndex = evaluation.winner
      const winnerResult = results[winnerIndex]

      if (!winnerResult || !winnerResult.success) {
        // Fallback to first successful
        const fallbackIndex = results.findIndex(r => r.success)
        return {
          success: true,
          summary: `Selected candidate ${fallbackIndex} (LLM picked invalid winner)`,
          data: {
            winner: {
              index: fallbackIndex,
              result: results[fallbackIndex],
              justification: 'Fallback selection',
            },
            allResults: results,
            evaluation,
          },
        }
      }

      return {
        success: true,
        summary: `Selected candidate ${winnerIndex}/${n}: ${evaluation.justification.slice(0, 50)}`,
        data: {
          winner: {
            index: winnerIndex,
            result: winnerResult,
            justification: evaluation.justification,
          },
          allResults: results,
          evaluation,
        },
      }
    } catch (error) {
      // Fallback: return first successful result
      const fallbackIndex = results.findIndex(r => r.success)
      return {
        success: true,
        summary: `Selected candidate ${fallbackIndex} (evaluation failed)`,
        data: {
          winner: {
            index: fallbackIndex,
            result: results[fallbackIndex],
            justification: 'Evaluation failed, returning first success',
          },
          allResults: results,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  },
})
