/**
 * Crypto Agent - Cryptography Challenges
 *
 * Analyzes and solves cryptography challenges.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

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

type CryptoParams = z.infer<typeof cryptoParams>

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

export const cryptoAgent = defineAgent<typeof cryptoParams, CryptoResult>({
  name: 'crypto',
  description: 'Analyze and solve cryptography challenges.',
  systemPrompt: CRYPTO_SYSTEM_PROMPT,
  parameters: cryptoParams,

  async execute(params: CryptoParams, agentContext): Promise<AgentResult<CryptoResult>> {
    let userPrompt = `Ciphertext:\n${params.ciphertext}`

    if (params.context) {
      userPrompt += `\n\nContext: ${params.context}`
    }
    if (params.knownPlaintext) {
      userPrompt += `\n\nKnown plaintext: ${params.knownPlaintext}`
    }

    const result = await executeAgentLLM({
      name: 'crypto',
      systemPrompt: CRYPTO_SYSTEM_PROMPT,
      userPrompt,
      context: agentContext,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Crypto analysis failed',
        data: {
          analysis: { cipherType: 'unknown', confidence: 'low', patterns: [] },
          approach: [],
          tools: [],
          decoded: null,
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as CryptoResult
      return {
        success: true,
        summary: `${data.analysis.cipherType} (${data.analysis.confidence})${data.decoded ? ' - decoded!' : ''}`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse crypto analysis',
        data: {
          analysis: { cipherType: 'unknown', confidence: 'low', patterns: [] },
          approach: [],
          tools: [],
          decoded: null,
        },
      }
    }
  },
})
