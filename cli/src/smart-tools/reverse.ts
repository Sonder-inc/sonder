/**
 * Reverse Agent - Reverse Engineering Analysis
 *
 * Analyzes binaries, decompiled code, and RE challenges.
 */

import { defineSimpleAgent } from './simple'

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

export const reverse = defineSimpleAgent<ReverseResult>({
  name: 'reverse',
  description: 'Analyzes binaries and reverse engineering challenges.',
  spawnerPrompt: 'Analyzes binaries, disassembly, and decompiled code. Identifies vulnerabilities and suggests RE approaches.',

  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Disassembly, decompiled code, or binary info' },
      context: { type: 'string', description: 'Challenge context or goal' },
      fileInfo: { type: 'string', description: 'Output of file/checksec commands' },
    },
    required: ['code'],
  },

  systemPrompt: `You are a reverse engineering analysis agent. You analyze binaries, decompiled code, and RE challenges.

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

Only output JSON, nothing else.`,
})
