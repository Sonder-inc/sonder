/**
 * SE Agent - Social Engineering
 *
 * Analyzes and helps with social engineering challenges.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

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

type SEParams = z.infer<typeof seParams>

export interface SEResult {
  scenario: string
  targetInfo: string[]
  approach: string[]
  osintSources: string[]
  redFlags: string[]
  defense: string[]
}

export const seAgent = defineAgent<typeof seParams, SEResult>({
  name: 'se',
  description: 'Analyze social engineering challenges (educational/CTF).',
  systemPrompt: SE_SYSTEM_PROMPT,
  parameters: seParams,

  async execute(params: SEParams, context): Promise<AgentResult<SEResult>> {
    let userPrompt = `Scenario: ${params.scenario}`

    if (params.targetInfo) {
      userPrompt += `\n\nKnown info: ${params.targetInfo}`
    }
    if (params.goal) {
      userPrompt += `\n\nGoal: ${params.goal}`
    }

    const result = await executeAgentLLM({
      name: 'se',
      systemPrompt: SE_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'SE analysis failed',
        data: {
          scenario: params.scenario,
          targetInfo: [],
          approach: [],
          osintSources: [],
          redFlags: [],
          defense: [],
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as SEResult
      return {
        success: true,
        summary: `${data.approach.length} approaches, ${data.osintSources.length} OSINT sources`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse SE analysis',
        data: {
          scenario: params.scenario,
          targetInfo: [],
          approach: [],
          osintSources: [],
          redFlags: [],
          defense: [],
        },
      }
    }
  },
})
