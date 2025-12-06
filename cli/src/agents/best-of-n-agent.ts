import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

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

type BestOfNParams = z.infer<typeof bestOfNParams>

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

export const bestOfNAgent = defineAgent<typeof bestOfNParams, BestOfNResult>({
  name: 'best_of_n',
  description: 'Evaluate multiple candidate solutions and select the best one. Useful for comparing approaches.',
  systemPrompt: BEST_OF_N_SYSTEM_PROMPT,
  parameters: bestOfNParams,

  async execute(params: BestOfNParams, agentContext): Promise<AgentResult<BestOfNResult>> {
    let userPrompt = `Task: ${params.task}\n\nCandidates to evaluate:\n`

    params.candidates.forEach((candidate, i) => {
      userPrompt += `\n--- Candidate ${i + 1} ---\n${candidate}\n`
    })

    if (params.criteria && params.criteria.length > 0) {
      userPrompt += `\n\nAdditional evaluation criteria: ${params.criteria.join(', ')}`
    }

    const result = await executeAgentLLM({
      name: 'best_of_n',
      systemPrompt: BEST_OF_N_SYSTEM_PROMPT,
      userPrompt,
      context: agentContext,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Evaluation failed',
        data: {
          evaluations: [],
          winner: { index: 0, justification: 'Evaluation failed' },
          recommendation: 'Could not evaluate candidates',
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as BestOfNResult
      const winnerScore = data.evaluations[data.winner.index]?.totalScore || 0

      return {
        success: true,
        summary: `Candidate ${data.winner.index + 1} wins (${winnerScore}/50)`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse evaluation',
        data: {
          evaluations: [],
          winner: { index: 0, justification: result.text },
          recommendation: 'Parse error',
        },
      }
    }
  },
})
