/**
 * Crypto Agent - Cryptography Analysis
 *
 * Analyzes and helps solve cryptography challenges.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const CRYPTO_SYSTEM_PROMPT = `You are a cryptography analysis agent. You help identify and solve crypto challenges.

Capabilities:
- Identify cipher types (Caesar, Vigenere, RSA, AES, etc.)
- Analyze patterns and frequencies
- Suggest decryption approaches
- Identify encoding (Base64, hex, etc.)

Output format (JSON):
{
  "analysis": {
    "cipherType": "identified cipher or encoding",
    "confidence": "high|medium|low",
    "patterns": ["observed patterns"]
  },
  "approach": ["step1", "step2"],
  "tools": ["tool1", "tool2"],
  "decoded": "decoded text if successful, null otherwise"
}

Only output JSON, nothing else.`

const cryptoParams = z.object({
  ciphertext: z.string().describe('The encrypted or encoded text'),
  context: z.string().optional().describe('Any context about the challenge'),
  knownPlaintext: z.string().optional().describe('Known plaintext if available'),
})

export interface CryptoResult {
  analysis: {
    cipherType: string
    confidence: 'high' | 'medium' | 'low'
    patterns: string[]
  }
  approach: string[]
  tools: string[]
  decoded: string | null
}

export const cryptoAgent = defineGeneratorAgent<typeof cryptoParams, CryptoResult>({
  name: 'crypto',
  id: 'crypto',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Analyzes and helps solve cryptography challenges.',

  spawnerPrompt: 'Analyzes ciphertext to identify cipher types and suggest decryption approaches. Use for crypto CTF challenges.',

  outputMode: 'structured_output',

  systemPrompt: CRYPTO_SYSTEM_PROMPT,

  parameters: cryptoParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM crypto analysis - just run a step
    yield 'STEP'
  },
})
