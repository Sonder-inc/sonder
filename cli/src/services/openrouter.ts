import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { streamText, generateText } from 'ai'
import type { CoreMessage } from 'ai'
import { getAvailableTools } from '../tools'

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

const SUMMARY_PROMPT = `Summarize this conversation in ONE concise sentence (max 60 chars). Focus on the main task/goal accomplished. Use action verbs. No quotes or punctuation at end.

Examples:
- Implemented user auth with JWT tokens
- Fixed memory leak in cache layer
- Explored nmap scanning techniques
- Analyzed SQLi vulnerability in login

Conversation:
`

const SMART_SHORTCUT_PROMPT = `You are predicting what the user will ask for next. Based on this conversation, what is the user most likely to request as their next message? Think about:
- What problem are they solving?
- What's the natural next step in their workflow?
- What is their research direction?
- What action would give most information?
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
    const openrouter = createOpenRouter({ apiKey })

    const result = await generateText({
      model: openrouter('anthropic/claude-3.5-haiku'),
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

export async function generateConversationSummary(conversationText: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return 'Conversation summary'

  try {
    const openrouter = createOpenRouter({ apiKey })

    const result = await generateText({
      model: openrouter('anthropic/claude-3.5-haiku'),
      prompt: SUMMARY_PROMPT + conversationText,
    })

    // Clean up the response
    const text = result.text.trim()
    // Remove leading dash/bullet and trailing punctuation
    const cleaned = text.replace(/^[-•]\s*/, '').replace(/[.!?]$/, '')
    // Truncate if too long
    return cleaned.length > 60 ? cleaned.slice(0, 57) + '...' : cleaned
  } catch {
    return 'Conversation summary'
  }
}

export async function getSmartShortcut(conversationSummary: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  try {
    const openrouter = createOpenRouter({ apiKey })

    const result = await generateText({
      model: openrouter('anthropic/claude-3.5-haiku'),
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

export interface StreamCallbacks {
  onChunk: (chunk: string, tokenCount: number) => void
  onToolCall?: (toolCall: ToolCallRequest) => void
  onReasoning?: (chunk: string) => void
  onReasoningComplete?: () => void
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

  // For thinking models, OpenRouter calculates budget as 80% of maxTokens
  const isThinkingModel = model.includes(':thinking')

  const openrouter = createOpenRouter({
    apiKey,
    // Enable reasoning tokens and set max_tokens for thinking models
    extraBody: isThinkingModel
      ? { include_reasoning: true, max_tokens: 16000 }
      : undefined,
  })

  const toolsToUse = useTools ? getAvailableTools() : undefined

  const result = streamText({
    model: openrouter(model),
    messages,
    tools: toolsToUse,
    abortSignal,
  })

  let fullText = ''
  let tokenCount = 0
  const toolCalls: ToolCallRequest[] = []
  let reasoningEnded = false

  try {
    for await (const part of result.fullStream) {
      if (abortSignal?.aborted) break

      // Debug: log part types to see what we're receiving
      if (process.env.DEBUG_STREAM) {
        console.error(`[stream] part.type: ${part.type}`)
      }

      if (part.type === 'reasoning-delta') {
        // Reasoning/thinking content from thinking models
        callbacks.onReasoning?.(part.text)
      } else if (part.type === 'reasoning-end') {
        // Reasoning phase complete
        reasoningEnded = true
        callbacks.onReasoningComplete?.()
      } else if (part.type === 'text-delta') {
        // End reasoning on first content chunk (for non-thinking models or fallback)
        if (!reasoningEnded) {
          reasoningEnded = true
          callbacks.onReasoningComplete?.()
        }
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
