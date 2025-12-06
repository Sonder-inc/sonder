/**
 * SE Agent - Social Engineering Analysis
 *
 * Analyzes social engineering challenges (educational/CTF).
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const SE_SYSTEM_PROMPT = `You are a social engineering analysis agent for CTF/educational purposes. You analyze SE challenges.

Capabilities:
- Analyze phishing scenarios
- OSINT methodology
- Pretexting analysis
- Information gathering strategies

Note: This is for educational/CTF purposes only. Focus on defensive understanding.

Output format (JSON):
{
  "scenario": "description of the SE scenario",
  "targetInfo": ["info1", "info2"],
  "approach": ["step1", "step2"],
  "osintSources": ["source1", "source2"],
  "redFlags": ["warning signs to look for"],
  "defense": ["how to defend against this"]
}

Only output JSON, nothing else.`

const seParams = z.object({
  scenario: z.string().describe('The SE challenge or scenario'),
  targetInfo: z.string().optional().describe('Known information about the target'),
  goal: z.string().optional().describe('What information or access is needed'),
})

export interface SEResult {
  scenario: string
  targetInfo: string[]
  approach: string[]
  osintSources: string[]
  redFlags: string[]
  defense: string[]
}

export const seAgent = defineGeneratorAgent<typeof seParams, SEResult>({
  name: 'se',
  id: 'se',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Analyzes social engineering challenges (educational/CTF).',

  spawnerPrompt: 'Analyzes social engineering scenarios for CTF/educational purposes. Focuses on OSINT and defensive understanding.',

  outputMode: 'structured_output',

  systemPrompt: SE_SYSTEM_PROMPT,

  parameters: seParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM SE analysis - just run a step
    yield 'STEP'
  },
})
