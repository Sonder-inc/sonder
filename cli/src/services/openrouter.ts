import { createOpenAI } from '@ai-sdk/openai'
import { streamText, generateText } from 'ai'
import { z } from 'zod'
import type { CoreMessage } from 'ai'

export type Message = CoreMessage

export interface ToolCallRequest {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface StreamResult {
  text: string
  toolCalls: ToolCallRequest[]
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

const SMART_SHORTCUT_PROMPT = `You are predicting what the user will ask for next. Based on this conversation, what is the user most likely to request as their next message? Think about:
- What problem are they solving?
- What's the natural next step in their workflow?
- What would they logically ask for after this?

Reply with ONLY the predicted request (3-8 words), lowercase, no punctuation. Write it as if you ARE the user making the request.

Examples:
- add the search feature
- fix the bug we discussed
- now test the changes
- refactor that function
- show me the config file

Conversation:
`

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

export async function getSmartShortcut(conversationSummary: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  try {
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })

    const result = await generateText({
      model: openrouter.chat('anthropic/claude-3.5-haiku'),
      prompt: SMART_SHORTCUT_PROMPT + conversationSummary,
    })

    // Clean up the response - get just the action phrase
    const text = result.text.trim().toLowerCase()
    // Remove leading dash/bullet if present
    const cleaned = text.replace(/^[-•]\s*/, '').replace(/[.!?]$/, '')

    // Validate length (3-8 words)
    const words = cleaned.split(/\s+/)
    if (words.length >= 2 && words.length <= 10) {
      return cleaned
    }

    return null
  } catch {
    return null
  }
}

// Define tools using Vercel AI SDK format
export const availableTools = {
  search_online: {
    description: 'Search the web for information. Use this when you need current information, documentation, or to find resources online.',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
    }),
  },
}

export interface StreamCallbacks {
  onChunk: (chunk: string, tokenCount: number) => void
  onToolCall?: (toolCall: ToolCallRequest) => void
}

export async function streamChat(
  messages: Message[],
  callbacks: StreamCallbacks,
  model: string,
  abortSignal?: AbortSignal,
  useTools: boolean = true,
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
    tools: useTools ? availableTools : undefined,
    abortSignal,
  })

  let fullText = ''
  let tokenCount = 0
  const toolCalls: ToolCallRequest[] = []

  try {
    for await (const part of result.fullStream) {
      if (abortSignal?.aborted) break

      if (part.type === 'text-delta') {
        fullText += part.text
        tokenCount = Math.ceil(fullText.length / 4)
        callbacks.onChunk(part.text, tokenCount)
      } else if (part.type === 'tool-call') {
        const toolCall: ToolCallRequest = {
          id: part.toolCallId,
          name: part.toolName,
          args: (part as { input?: Record<string, unknown> }).input ?? {},
        }
        toolCalls.push(toolCall)
        callbacks.onToolCall?.(toolCall)
      }
    }
  } catch (err) {
    if (!abortSignal?.aborted) throw err
  }

  return {
    text: fullText,
    toolCalls,
    promptTokens: 0,
    completionTokens: tokenCount,
    totalTokens: tokenCount,
  }
}
