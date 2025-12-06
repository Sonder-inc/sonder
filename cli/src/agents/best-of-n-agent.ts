/**
 * Best-of-N Agent - Solution Evaluation
 *
 * Evaluates multiple candidate solutions and selects the best one.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const BEST_OF_N_SYSTEM_PROMPT = `You are a solution evaluation agent. Given multiple candidate solutions, you:

1. Evaluate each solution against criteria
2. Identify strengths and weaknesses
3. Select the best solution with justification
4. Optionally synthesize a better solution from the best parts

Evaluation criteria:
- Correctness: Does it solve the problem?
- Completeness: Does it handle edge cases?
- Efficiency: Is it optimal?
- Security: Any vulnerabilities?
- Maintainability: Is it clean and readable?

Output format (JSON):
{
  "evaluations": [
    {
      "candidateIndex": 0,
      "scores": {
        "correctness": 0-10,
        "completeness": 0-10,
        "efficiency": 0-10,
        "security": 0-10,
        "maintainability": 0-10
      },
      "strengths": ["..."],
      "weaknesses": ["..."],
      "totalScore": 0-50
    }
  ],
  "winner": {
    "index": 0,
    "justification": "why this is best"
  },
  "synthesis": "optional improved solution combining best parts",
  "recommendation": "final recommendation"
}

Only output JSON, nothing else.`

const bestOfNParams = z.object({
  task: z.string().describe('The task/problem being solved'),
  candidates: z.array(z.string()).min(2).describe('Candidate solutions to evaluate'),
  criteria: z.array(z.string()).optional().describe('Custom evaluation criteria'),
})

export interface CandidateEvaluation {
  candidateIndex: number
  scores: {
    correctness: number
    completeness: number
    efficiency: number
    security: number
    maintainability: number
  }
  strengths: string[]
  weaknesses: string[]
  totalScore: number
}

export interface BestOfNResult {
  evaluations: CandidateEvaluation[]
  winner: {
    index: number
    justification: string
  }
  synthesis?: string
  recommendation: string
}

export const bestOfNAgent = defineGeneratorAgent<typeof bestOfNParams, BestOfNResult>({
  name: 'best_of_n',
  id: 'best_of_n',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Evaluate multiple candidate solutions and select the best one.',

  spawnerPrompt: 'Evaluates multiple candidate solutions against criteria and selects the best one. Useful for comparing different approaches or implementations.',

  outputMode: 'structured_output',

  systemPrompt: BEST_OF_N_SYSTEM_PROMPT,

  parameters: bestOfNParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM evaluation - just run a step
    yield 'STEP'
  },
})
