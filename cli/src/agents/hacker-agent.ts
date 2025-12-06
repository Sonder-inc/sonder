/**
 * Hacker Agent - School Mode
 *
 * Specialized agent for guided penetration testing on HTB/THM machines.
 * Works alongside the user, suggesting next steps and explaining techniques.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

const HACKER_SYSTEM_PROMPT = `You are sonder's hacker agent, a friendly pentesting mentor.

You help users learn penetration testing through hands-on practice on HackTheBox and TryHackMe machines.

Your approach:
1. GUIDE, don't spoil - suggest next steps without giving answers
2. EXPLAIN techniques as you go - this is educational
3. Follow a methodical approach: recon → enum → exploit → privesc → loot
4. Celebrate progress and encourage persistence

Current machine context:
- Name: {{machineName}}
- Platform: {{platform}}
- IP: {{targetIP}}
- OS: {{os}}
- Difficulty: {{difficulty}}

Phase tracking:
1. Reconnaissance - nmap, initial scanning
2. Enumeration - service probing, directory busting, vulnerability scanning
3. Initial Access - exploiting vulnerabilities
4. Privilege Escalation - getting root/admin
5. Post Exploitation - flags, persistence, pivoting

Output format (JSON):
{
  "phase": "recon|enum|exploit|privesc|post",
  "suggestion": "What to try next (without spoilers)",
  "explanation": "Why this approach works",
  "command": "Optional command to run (if appropriate)",
  "tools": ["relevant", "tools"],
  "hints": ["progressive", "hints", "if stuck"],
  "progress": 0-100
}

Be encouraging, technical, and educational. Never give direct flag values.`

const hackerParams = z.object({
  machineName: z.string(),
  machineId: z.string(),
  platform: z.enum(['htb', 'thm']),
  targetIP: z.string(),
  os: z.enum(['linux', 'windows']),
  difficulty: z.enum(['easy', 'medium', 'hard', 'insane']),
  userMessage: z.string().describe('What the user said or is asking'),
  commandHistory: z.array(z.object({
    command: z.string(),
    output: z.string().optional(),
  })).optional(),
  currentPhase: z.enum(['recon', 'enum', 'exploit', 'privesc', 'post']).optional(),
  discoveries: z.array(z.string()).optional().describe('Things already discovered'),
})

type HackerParams = z.infer<typeof hackerParams>

export interface HackerResult {
  phase: 'recon' | 'enum' | 'exploit' | 'privesc' | 'post'
  suggestion: string
  explanation: string
  command?: string
  tools: string[]
  hints: string[]
  progress: number
}

export const hackerAgent = defineAgent<typeof hackerParams, HackerResult>({
  name: 'hacker',
  description: 'Pentesting mentor for HTB/THM machines. Guides through recon, enum, exploit, and privesc phases.',
  systemPrompt: HACKER_SYSTEM_PROMPT,
  parameters: hackerParams,

  async execute(params: HackerParams, context): Promise<AgentResult<HackerResult>> {
    // Build context-aware prompt
    const systemPrompt = HACKER_SYSTEM_PROMPT
      .replace('{{machineName}}', params.machineName)
      .replace('{{platform}}', params.platform.toUpperCase())
      .replace('{{targetIP}}', params.targetIP)
      .replace('{{os}}', params.os)
      .replace('{{difficulty}}', params.difficulty)

    let userPrompt = `User: ${params.userMessage}`

    if (params.currentPhase) {
      userPrompt += `\n\nCurrent phase: ${params.currentPhase}`
    }

    if (params.discoveries?.length) {
      userPrompt += `\n\nDiscoveries so far:\n${params.discoveries.map(d => `- ${d}`).join('\n')}`
    }

    if (params.commandHistory?.length) {
      userPrompt += '\n\nRecent commands:'
      for (const cmd of params.commandHistory.slice(-5)) {
        userPrompt += `\n$ ${cmd.command}`
        if (cmd.output) {
          const truncated = cmd.output.length > 500 ? cmd.output.slice(0, 500) + '...' : cmd.output
          userPrompt += `\n${truncated}`
        }
      }
    }

    const result = await executeAgentLLM({
      name: 'hacker',
      systemPrompt,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Hacker agent failed',
        data: {
          phase: 'recon',
          suggestion: 'Something went wrong. Try running an nmap scan to start fresh.',
          explanation: '',
          tools: ['nmap'],
          hints: [],
          progress: 0,
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as HackerResult

      return {
        success: true,
        summary: `[${data.phase}] ${data.suggestion.slice(0, 50)}...`,
        data,
      }
    } catch {
      // If JSON parsing fails, extract what we can
      return {
        success: true,
        summary: 'Guidance provided',
        data: {
          phase: params.currentPhase || 'recon',
          suggestion: result.text.slice(0, 200),
          explanation: '',
          tools: [],
          hints: [],
          progress: 0,
        },
      }
    }
  },
})
