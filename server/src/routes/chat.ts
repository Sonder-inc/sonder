import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { db, users, sessions, usage, transactions } from '../db'
import { calculateCost, CREDIT_COSTS } from '../lib/constants'

export const chatRoutes = new Hono()

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

/**
 * POST /chat/completions
 * Proxy AI requests, track tokens, deduct credits
 */
chatRoutes.post('/completions', async (c) => {
  // Auth check
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionToken = authHeader.slice(7)

  // Get session and user
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionToken))
    .limit(1)

  if (!session || new Date() > session.expiresAt) {
    return c.json({ error: 'Invalid or expired session' }, 401)
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Parse request
  const body = await c.req.json<ChatRequest>()
  const { model, messages, stream: shouldStream = false, temperature, max_tokens } = body

  if (!model || !messages?.length) {
    return c.json({ error: 'Model and messages required' }, 400)
  }

  // Check credits (rough estimate for input)
  const inputTokensEstimate = estimateTokens(messages)
  const estimatedCost = calculateCost(model, inputTokensEstimate, 0)

  // Allow some buffer for users with low credits
  if (user.credits < estimatedCost && user.tier === 'free') {
    return c.json({
      error: 'Insufficient credits',
      credits: user.credits,
      estimatedCost,
    }, 402)
  }

  // Proxy to OpenRouter
  if (!OPENROUTER_API_KEY) {
    return c.json({ error: 'Server not configured for AI requests' }, 500)
  }

  try {
    const openrouterResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sonder.dev',
        'X-Title': 'Sonder',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: shouldStream,
        temperature,
        max_tokens,
      }),
    })

    if (!openrouterResponse.ok) {
      const errorText = await openrouterResponse.text()
      console.error('OpenRouter error:', errorText)
      return c.json({ error: 'AI request failed', details: errorText }, openrouterResponse.status as any)
    }

    if (shouldStream) {
      // Stream response and count tokens at the end
      return stream(c, async (streamWriter) => {
        const reader = openrouterResponse.body?.getReader()
        if (!reader) {
          await streamWriter.write('data: {"error": "No response body"}\n\n')
          return
        }

        const decoder = new TextDecoder()
        let fullContent = ''
        let inputTokens = 0
        let outputTokens = 0

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            await streamWriter.write(chunk)

            // Parse SSE to accumulate content and get token counts
            const lines = chunk.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.choices?.[0]?.delta?.content) {
                    fullContent += parsed.choices[0].delta.content
                  }
                  // Get usage from final chunk
                  if (parsed.usage) {
                    inputTokens = parsed.usage.prompt_tokens || 0
                    outputTokens = parsed.usage.completion_tokens || 0
                  }
                } catch {}
              }
            }
          }
        } finally {
          reader.releaseLock()
        }

        // Record usage and deduct credits
        if (inputTokens || outputTokens || fullContent) {
          // Estimate if not provided
          if (!outputTokens && fullContent) {
            outputTokens = Math.ceil(fullContent.length / 4)
          }
          if (!inputTokens) {
            inputTokens = inputTokensEstimate
          }

          const cost = calculateCost(model, inputTokens, outputTokens)

          // Record usage
          await db.insert(usage).values({
            id: nanoid(),
            userId: user.id,
            model,
            inputTokens,
            outputTokens,
            cost,
          })

          // Deduct credits (unless unlimited tier)
          if (user.tier !== 'black') {
            await db
              .update(users)
              .set({ credits: Math.max(0, user.credits - cost) })
              .where(eq(users.id, user.id))

            // Record transaction
            await db.insert(transactions).values({
              id: nanoid(),
              userId: user.id,
              type: 'usage',
              amount: -cost,
              description: `${model}: ${inputTokens} in, ${outputTokens} out`,
            })
          }
        }
      })
    } else {
      // Non-streaming response
      const data = await openrouterResponse.json() as any

      // Get token counts
      const inputTokens = data.usage?.prompt_tokens || inputTokensEstimate
      const outputTokens = data.usage?.completion_tokens || 0
      const cost = calculateCost(model, inputTokens, outputTokens)

      // Record usage
      await db.insert(usage).values({
        id: nanoid(),
        userId: user.id,
        model,
        inputTokens,
        outputTokens,
        cost,
      })

      // Deduct credits (unless unlimited tier)
      if (user.tier !== 'black') {
        await db
          .update(users)
          .set({ credits: Math.max(0, user.credits - cost) })
          .where(eq(users.id, user.id))

        await db.insert(transactions).values({
          id: nanoid(),
          userId: user.id,
          type: 'usage',
          amount: -cost,
          description: `${model}: ${inputTokens} in, ${outputTokens} out`,
        })
      }

      return c.json(data)
    }
  } catch (error) {
    console.error('Chat completions error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * Rough token estimation (4 chars per token average)
 */
function estimateTokens(messages: ChatMessage[]): number {
  const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0)
  return Math.ceil(totalChars / 4)
}
