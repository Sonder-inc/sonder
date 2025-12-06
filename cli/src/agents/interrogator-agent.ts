import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

const INTERROGATOR_SYSTEM_PROMPT = `You are a clarification agent. Your job is to identify ambiguities and ask smart follow-up questions.

When given a user request, you:
1. Identify what's unclear or underspecified
2. Consider different interpretations
3. Generate targeted questions to resolve ambiguity (max 4 questions)
4. Prioritize questions by importance

For technical/pentesting tasks, consider:
- Target scope and authorization
- Specific tools or techniques preferred
- Output format expectations
- Time/resource constraints

Output format (JSON):
{
  "understanding": "what you think the user wants",
  "ambiguities": ["list of unclear points"],
  "questions": [
    {
      "id": "unique_id",
      "header": "short label (max 12 chars, e.g. 'Scope', 'Method')",
      "question": "the full question",
      "options": [
        { "label": "Option 1", "description": "what this means" },
        { "label": "Option 2", "description": "what this means" }
      ],
      "priority": "high|medium|low"
    }
  ],
  "assumptions": ["assumptions made if questions go unanswered"],
  "canProceed": true/false
}

Rules:
- Keep headers very short (max 12 chars)
- Each question should have 2-4 options
- Options need both label and description
- Only output JSON, nothing else.`

const interrogatorParams = z.object({
  userRequest: z.string().describe('The user\'s request to clarify'),
  previousContext: z.string().optional().describe('Previous conversation for context'),
  domain: z.string().optional().describe('Domain context (e.g., "pentesting", "coding")'),
})

type InterrogatorParams = z.infer<typeof interrogatorParams>

export interface QuestionOption {
  label: string
  description: string
}

export interface ClarificationQuestion {
  id: string
  header: string
  question: string
  options: QuestionOption[]
  priority: 'high' | 'medium' | 'low'
}

export interface InterrogatorResult {
  understanding: string
  ambiguities: string[]
  questions: ClarificationQuestion[]
  assumptions: string[]
  canProceed: boolean
}

export const interrogatorAgent = defineAgent<typeof interrogatorParams, InterrogatorResult>({
  name: 'interrogator',
  description: 'Identify ambiguities and generate clarifying questions. Helps refine unclear requests.',
  systemPrompt: INTERROGATOR_SYSTEM_PROMPT,
  parameters: interrogatorParams,

  async execute(params: InterrogatorParams, agentContext): Promise<AgentResult<InterrogatorResult>> {
    let userPrompt = `User request: "${params.userRequest}"`

    if (params.domain) {
      userPrompt += `\n\nDomain: ${params.domain}`
    }

    if (params.previousContext) {
      userPrompt += `\n\nPrevious context:\n${params.previousContext}`
    }

    userPrompt += '\n\nIdentify ambiguities and generate clarifying questions.'

    const result = await executeAgentLLM({
      name: 'interrogator',
      systemPrompt: INTERROGATOR_SYSTEM_PROMPT,
      userPrompt,
      context: agentContext,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Analysis failed',
        data: {
          understanding: '',
          ambiguities: [],
          questions: [],
          assumptions: [],
          canProceed: true, // default to proceeding if analysis fails
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as InterrogatorResult
      const highPriority = data.questions.filter(q => q.priority === 'high').length

      return {
        success: true,
        summary: highPriority > 0
          ? `${highPriority} critical question${highPriority !== 1 ? 's' : ''}`
          : data.canProceed
            ? 'Clear enough to proceed'
            : `${data.questions.length} question${data.questions.length !== 1 ? 's' : ''}`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse analysis',
        data: {
          understanding: result.text,
          ambiguities: [],
          questions: [],
          assumptions: [],
          canProceed: true,
        },
      }
    }
  },
})
