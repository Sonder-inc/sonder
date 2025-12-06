/**
 * Interrogator Agent - Clarification Questions
 *
 * Identifies ambiguities and generates clarifying questions.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

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

export const interrogatorAgent = defineGeneratorAgent<typeof interrogatorParams, InterrogatorResult>({
  name: 'interrogator',
  id: 'interrogator',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Identifies ambiguities and generates clarifying questions.',

  spawnerPrompt: 'Analyzes user requests to identify ambiguities and generate targeted clarifying questions. Use to refine unclear requirements.',

  outputMode: 'structured_output',

  systemPrompt: INTERROGATOR_SYSTEM_PROMPT,

  parameters: interrogatorParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM analysis - just run a step
    yield 'STEP'
  },
})
