import { createOpenAI } from '@ai-sdk/openai'
import { streamText, generateText } from 'ai'

export type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamResult {
  text: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

const FLAVOR_PROMPT = `Reply with ONE word only - a fun gerund (verb ending in -ing) that relates to this message. Be creative and whimsical. Capitalize first letter. No punctuation. Avoid alarming/destructive words.

Message: `

const FALLBACK_WORDS = [
  'Pondering', 'Conjuring', 'Brewing', 'Crafting', 'Weaving',
  'Dreaming', 'Exploring', 'Discovering', 'Imagining', 'Creating',
]

export async function getFlavorWord(userMessage: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]
  }

  try {
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })

    const result = await generateText({
      model: openrouter.chat('anthropic/claude-3.5-haiku'),
      prompt: FLAVOR_PROMPT + userMessage,
    })

    // Clean up the response - just get the first word ending in -ing
    const text = result.text.trim()
    const match = text.match(/[A-Z][a-z]*ing/)?.[0]
    if (match) return match

    // Fallback: take first word and clean it
    const word = text.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '')
    if (word && word.length > 2) return word

    return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]
  } catch {
    return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]
  }
}

export async function streamChat(
  messages: Message[],
  onChunk: (chunk: string, tokenCount: number) => void,
  model: string,
  abortSignal?: AbortSignal,
): Promise<StreamResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  })

  const result = streamText({
    model: openrouter.chat(model),
    messages,
    abortSignal,
  })

  let fullText = ''
  let tokenCount = 0
  try {
    for await (const chunk of result.textStream) {
      if (abortSignal?.aborted) break
      fullText += chunk
      // Estimate tokens: ~4 chars per token on average
      tokenCount = Math.ceil(fullText.length / 4)
      onChunk(chunk, tokenCount)
    }
  } catch (err) {
    // Stream was aborted or errored
    if (!abortSignal?.aborted) throw err
  }

  return {
    text: fullText,
    promptTokens: 0,
    completionTokens: tokenCount,
    totalTokens: tokenCount,
  }
}
