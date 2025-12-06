/**
 * Reverse Agent - Reverse Engineering
 *
 * Analyzes binaries, decompiled code, and reverse engineering challenges.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

const REVERSE_SYSTEM_PROMPT = `You are a reverse engineering analysis agent. You analyze binaries, decompiled code, and RE challenges.

Capabilities:
- Analyze disassembly/decompiled code
- Identify algorithms and logic
- Find vulnerabilities in binaries
- Suggest debugging strategies

Output format (JSON):
{
  "analysis": {
    "binaryType": "ELF|PE|Mach-O|other",
    "architecture": "x86|x64|ARM|other",
    "protections": ["PIE", "NX", "Canary", "RELRO"]
  },
  "functions": [
    {"name": "main", "purpose": "entry point", "interesting": true}
  ],
  "vulnerabilities": ["buffer overflow in func X"],
  "approach": ["step1", "step2"],
  "tools": ["gdb", "ghidra", "radare2"]
}

Only output JSON, nothing else.`

const reverseParams = z.object({
  code: z.string().describe('Disassembly, decompiled code, or binary info'),
  context: z.string().optional().describe('Challenge context or goal'),
  fileInfo: z.string().optional().describe('Output of file/checksec commands'),
})

type ReverseParams = z.infer<typeof reverseParams>

export interface ReverseResult {
  analysis: {
    binaryType: string
    architecture: string
    protections: string[]
  }
  functions: Array<{ name: string; purpose: string; interesting: boolean }>
  vulnerabilities: string[]
  approach: string[]
  tools: string[]
}

export const reverseAgent = defineAgent<typeof reverseParams, ReverseResult>({
  name: 'reverse',
  description: 'Analyze binaries and reverse engineering challenges.',
  systemPrompt: REVERSE_SYSTEM_PROMPT,
  parameters: reverseParams,

  async execute(params: ReverseParams, context): Promise<AgentResult<ReverseResult>> {
    let userPrompt = `Code/Disassembly:\n${params.code}`

    if (params.fileInfo) {
      userPrompt += `\n\nFile info:\n${params.fileInfo}`
    }
    if (params.context) {
      userPrompt += `\n\nContext: ${params.context}`
    }

    const result = await executeAgentLLM({
      name: 'reverse',
      systemPrompt: REVERSE_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Reverse analysis failed',
        data: {
          analysis: { binaryType: 'unknown', architecture: 'unknown', protections: [] },
          functions: [],
          vulnerabilities: [],
          approach: [],
          tools: [],
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as ReverseResult
      const vulnCount = data.vulnerabilities.length
      return {
        success: true,
        summary: `${data.analysis.binaryType}/${data.analysis.architecture}${vulnCount ? `, ${vulnCount} vulns` : ''}`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse reverse analysis',
        data: {
          analysis: { binaryType: 'unknown', architecture: 'unknown', protections: [] },
          functions: [],
          vulnerabilities: [],
          approach: [],
          tools: [],
        },
      }
    }
  },
})
