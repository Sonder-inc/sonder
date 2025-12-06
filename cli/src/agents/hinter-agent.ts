/**
 * Hinter Agent - Progressive Hints Without Spoilers
 *
 * Provides progressive hints for CTF/HTB/THM challenges.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const HINTER_SYSTEM_PROMPT = `You are a hint agent for CTF/pentesting challenges. You provide progressive hints without spoilers.

Rules:
1. Never give away the answer directly
2. Start with subtle nudges, get more specific if asked
3. Reference methodology without exact steps
4. Encourage learning and exploration

Output format (JSON):
{
  "hint": "the hint text",
  "hintLevel": 1-5,
  "category": "recon|enum|exploit|privesc|crypto|web|forensics|reverse|misc",
  "nextHint": "what the next hint would cover (without revealing it)"
}

Only output JSON, nothing else.`

const hinterParams = z.object({
  challenge: z.string().describe('Description of the challenge or current situation'),
  previousHints: z.array(z.string()).optional().describe('Hints already given'),
  hintLevel: z.number().optional().default(1).describe('How specific (1=vague, 5=almost answer)'),
})

export interface HinterResult {
  hint: string
  hintLevel: number
  category: string
  nextHint: string
}

export const hinterAgent = defineGeneratorAgent<typeof hinterParams, HinterResult>({
  name: 'hinter',
  id: 'hinter',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Provides progressive hints for CTF challenges without spoilers.',

  spawnerPrompt: 'Gives progressive hints for CTF/pentesting challenges without revealing answers. Use when stuck on a challenge.',

  outputMode: 'structured_output',

  systemPrompt: HINTER_SYSTEM_PROMPT,

  parameters: hinterParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM hint generation - just run a step
    yield 'STEP'
  },
})
