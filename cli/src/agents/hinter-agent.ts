/**
 * Hinter Agent - Progressive Hints Without Spoilers
 *
 * Provides progressive hints for CTF/HTB/THM challenges.
 */

import { defineSimpleAgent } from './simple-agent'

export interface HinterResult {
  hint: string
  hintLevel: number
  category: string
  nextHint: string
}

export const hinterAgent = defineSimpleAgent<HinterResult>({
  name: 'hinter',
  description: 'Provides progressive hints for CTF challenges without spoilers.',
  spawnerPrompt: 'Gives progressive hints for CTF/pentesting challenges without revealing answers. Use when stuck on a challenge.',

  parameters: {
    type: 'object',
    properties: {
      challenge: { type: 'string', description: 'Description of the challenge or current situation' },
      previousHints: { type: 'array', items: { type: 'string' }, description: 'Hints already given' },
      hintLevel: { type: 'number', description: 'How specific (1=vague, 5=almost answer)', default: 1 },
    },
    required: ['challenge'],
  },

  systemPrompt: `You are a hint agent for CTF/pentesting challenges. You provide progressive hints without spoilers.

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

Only output JSON, nothing else.`,
})
