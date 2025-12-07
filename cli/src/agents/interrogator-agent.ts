/**
 * Interrogator Agent - Clarification Questions
 *
 * Identifies ambiguities and generates clarifying questions.
 */

import { defineSimpleAgent } from './simple-agent'

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

export const interrogatorAgent = defineSimpleAgent<InterrogatorResult>({
  name: 'interrogator',
  description: 'Identifies ambiguities and generates clarifying questions.',
  spawnerPrompt: 'Analyzes user requests to identify ambiguities and generate targeted clarifying questions. Use to refine unclear requirements.',

  parameters: {
    type: 'object',
    properties: {
      userRequest: { type: 'string', description: "The user's request to clarify" },
      previousContext: { type: 'string', description: 'Previous conversation for context' },
      domain: { type: 'string', description: 'Domain context (e.g., "pentesting", "coding")' },
    },
    required: ['userRequest'],
  },

  systemPrompt: `You are a clarification agent. Your job is to identify ambiguities and ask smart follow-up questions.

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
- Only output JSON, nothing else.`,
})
