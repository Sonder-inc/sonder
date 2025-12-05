import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'

export type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function streamChat(
  messages: Message[],
  onChunk: (chunk: string) => void,
  model: string,
): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  })

  const result = streamText({
    model: openrouter.chat(model),
    messages,
  })

  for await (const chunk of result.textStream) {
    onChunk(chunk)
  }
}
