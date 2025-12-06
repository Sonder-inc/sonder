/**
 * Hinter Agent - Hints Without Spoilers
 *
 * Provides progressive hints for CTF/HTB/THM challenges.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

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

type HinterParams = z.infer<typeof hinterParams>

export interface HinterResult {
  hint: string
  hintLevel: number
  category: string
  nextHint: string
}

export const hinterAgent = defineAgent<typeof hinterParams, HinterResult>({
  name: 'hinter',
  description: 'Provide progressive hints for challenges without spoilers.',
  systemPrompt: HINTER_SYSTEM_PROMPT,
  parameters: hinterParams,

  async execute(params: HinterParams, context): Promise<AgentResult<HinterResult>> {
    let userPrompt = `Challenge: ${params.challenge}\nHint level requested: ${params.hintLevel}/5`

    if (params.previousHints?.length) {
      userPrompt += `\n\nPrevious hints given:\n${params.previousHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    }

    const result = await executeAgentLLM({
      name: 'hinter',
      systemPrompt: HINTER_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Failed to generate hint',
        data: { hint: '', hintLevel: 1, category: 'misc', nextHint: '' },
      }
    }

    try {
      const data = JSON.parse(result.text) as HinterResult
      return {
        success: true,
        summary: `Level ${data.hintLevel} hint (${data.category})`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse hint',
        data: { hint: result.text, hintLevel: 1, category: 'misc', nextHint: '' },
      }
    }
  },
})
