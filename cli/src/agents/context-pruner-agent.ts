import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

const CONTEXT_PRUNER_SYSTEM_PROMPT = `You are a context optimization agent. Your job is to compress and prioritize context for LLM calls.

Given a large context (conversation history, file contents, etc.), you:
1. Identify the most relevant information for the current task
2. Remove redundant or outdated information
3. Summarize verbose sections
4. Preserve critical details (code, commands, errors)

Rules:
- Keep exact code snippets if they're relevant
- Preserve error messages verbatim
- Summarize repeated back-and-forth
- Remove pleasantries and filler
- Prioritize recent and task-relevant info

Output format (JSON):
{
  "prunedContext": "the compressed context",
  "removedSections": ["what was removed and why"],
  "preservedCritical": ["key items preserved exactly"],
  "compressionRatio": 0.5,
  "tokenEstimate": 1000
}

Only output JSON, nothing else.`

const contextPrunerParams = z.object({
  context: z.string().describe('The full context to prune'),
  currentTask: z.string().describe('What the user is currently trying to do'),
  maxTokens: z.number().optional().default(4000).describe('Target token limit'),
})

type ContextPrunerParams = z.infer<typeof contextPrunerParams>

export interface ContextPrunerResult {
  prunedContext: string
  removedSections: string[]
  preservedCritical: string[]
  compressionRatio: number
  tokenEstimate: number
}

export const compactAgent = defineAgent<typeof contextPrunerParams, ContextPrunerResult>({
  name: 'compact',
  description: 'Compress and optimize context for LLM calls. Reduces token usage while preserving critical info.',
  systemPrompt: CONTEXT_PRUNER_SYSTEM_PROMPT,
  parameters: contextPrunerParams,

  async execute(params: ContextPrunerParams, agentContext): Promise<AgentResult<ContextPrunerResult>> {
    const userPrompt = `Current task: ${params.currentTask}
Target max tokens: ${params.maxTokens}

Context to prune:
---
${params.context}
---

Compress this context while preserving information critical to the current task.`

    const result = await executeAgentLLM({
      name: 'compact',
      systemPrompt: CONTEXT_PRUNER_SYSTEM_PROMPT,
      userPrompt,
      context: agentContext,
    })

    if (!result.success) {
      // On failure, return original context truncated
      const truncated = params.context.slice(0, params.maxTokens * 4) // rough char estimate
      return {
        success: false,
        summary: 'Pruning failed, using truncation',
        data: {
          prunedContext: truncated,
          removedSections: [],
          preservedCritical: [],
          compressionRatio: truncated.length / params.context.length,
          tokenEstimate: Math.floor(truncated.length / 4),
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as ContextPrunerResult
      const ratio = Math.round(data.compressionRatio * 100)

      return {
        success: true,
        summary: `${ratio}% compression, ~${data.tokenEstimate} tokens`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse pruned context',
        data: {
          prunedContext: params.context.slice(0, params.maxTokens * 4),
          removedSections: [],
          preservedCritical: [],
          compressionRatio: 1,
          tokenEstimate: params.maxTokens,
        },
      }
    }
  },
})
