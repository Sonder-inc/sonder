/**
 * SE Agent - Social Engineering Analysis
 *
 * Analyzes social engineering challenges (educational/CTF).
 */

import { defineSimpleAgent } from './simple-agent'

export interface SEResult {
  scenario: string
  targetInfo: string[]
  approach: string[]
  osintSources: string[]
  redFlags: string[]
  defense: string[]
}

export const seAgent = defineSimpleAgent<SEResult>({
  name: 'se',
  description: 'Analyzes social engineering challenges (educational/CTF).',
  spawnerPrompt: 'Analyzes social engineering scenarios for CTF/educational purposes. Focuses on OSINT and defensive understanding.',

  parameters: {
    type: 'object',
    properties: {
      scenario: { type: 'string', description: 'The SE challenge or scenario' },
      targetInfo: { type: 'string', description: 'Known information about the target' },
      goal: { type: 'string', description: 'What information or access is needed' },
    },
    required: ['scenario'],
  },

  systemPrompt: `You are a social engineering analysis agent for CTF/educational purposes. You analyze SE challenges.

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

Only output JSON, nothing else.`,
})
