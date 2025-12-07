/**
 * Crypto Agent - Cryptography Analysis
 *
 * Analyzes and helps solve cryptography challenges.
 */

import { defineSimpleAgent } from './simple-agent'

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

export const cryptoAgent = defineSimpleAgent<CryptoResult>({
  name: 'crypto',
  description: 'Analyzes and helps solve cryptography challenges.',
  spawnerPrompt: 'Analyzes ciphertext to identify cipher types and suggest decryption approaches. Use for crypto CTF challenges.',

  parameters: {
    type: 'object',
    properties: {
      ciphertext: { type: 'string', description: 'The encrypted or encoded text' },
      context: { type: 'string', description: 'Any context about the challenge' },
      knownPlaintext: { type: 'string', description: 'Known plaintext if available' },
    },
    required: ['ciphertext'],
  },

  systemPrompt: `You are a cryptography analysis agent. You help identify and solve crypto challenges.

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

Only output JSON, nothing else.`,
})
