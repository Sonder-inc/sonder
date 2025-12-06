/**
 * Reverse Agent - Reverse Engineering Analysis
 *
 * Analyzes binaries, decompiled code, and RE challenges.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

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

export const reverseAgent = defineGeneratorAgent<typeof reverseParams, ReverseResult>({
  name: 'reverse',
  id: 'reverse',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Analyzes binaries and reverse engineering challenges.',

  spawnerPrompt: 'Analyzes binaries, disassembly, and decompiled code. Identifies vulnerabilities and suggests RE approaches.',

  outputMode: 'structured_output',

  systemPrompt: REVERSE_SYSTEM_PROMPT,

  parameters: reverseParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM RE analysis - just run a step
    yield 'STEP'
  },
})
