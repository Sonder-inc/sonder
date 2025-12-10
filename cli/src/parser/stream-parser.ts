export type StreamEvent =
  | { kind: 'init'; sessionId: string }
  | { kind: 'text'; content: string }
  | { kind: 'thinking'; content: string }
  | { kind: 'thinking_complete' }
  | { kind: 'tool_start'; id: string; name: string; input: Record<string, unknown> }
  | { kind: 'tool_result'; toolUseId: string; result: unknown }
  | { kind: 'usage'; tokens: number }
  | { kind: 'complete'; cost: number; durationMs: number; totalTokens: number; sessionId?: string }

/**
 * Lightweight parser for `claude --output-format stream-json`
 * Handles chunked NDJSON output and normalizes common event shapes
 */
export class StreamParser {
  private buffer = ''

  processChunk(chunk: string): StreamEvent[] {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() ?? ''

    const events: StreamEvent[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const parsed = this.parseJson(trimmed)
      if (!parsed) continue

      const normalized = this.normalize(parsed)
      if (!normalized) continue

      if (Array.isArray(normalized)) {
        events.push(...normalized)
      } else {
        events.push(normalized)
      }
    }

    return events
  }

  reset(): void {
    this.buffer = ''
  }

  private parseJson(line: string): unknown {
    try {
      return JSON.parse(line)
    } catch {
      // If we failed to parse, stash the line back into the buffer to try again on the next chunk
      this.buffer = line
      return null
    }
  }

  private normalize(payload: any): StreamEvent | StreamEvent[] | null {
    if (!payload || typeof payload !== 'object') return null

    // Already in normalized form
    if (typeof payload.kind === 'string') {
      return this.normalizeKindPayload(payload)
    }

    const type = payload.type

    // Claude Code headless: init message with session_id
    if (type === 'system' && payload.subtype === 'init') {
      return { kind: 'init', sessionId: payload.session_id ?? '' }
    }

    // Claude Code headless: result message with final stats
    if (type === 'result') {
      return {
        kind: 'complete',
        cost: payload.cost_usd ?? payload.total_cost_usd ?? 0,
        durationMs: payload.duration_ms ?? 0,
        totalTokens: payload.num_turns ?? 0,
        sessionId: payload.session_id,
      }
    }

    // Claude Code headless: assistant message with content blocks
    if (type === 'assistant' && payload.message?.content) {
      const content = payload.message.content
      if (Array.isArray(content)) {
        const events: StreamEvent[] = []
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            events.push({ kind: 'text', content: block.text })
          } else if (block.type === 'thinking' && block.thinking) {
            events.push({ kind: 'thinking', content: block.thinking })
          } else if (block.type === 'tool_use') {
            events.push({
              kind: 'tool_start',
              id: block.id ?? '',
              name: block.name ?? '',
              input: block.input ?? {},
            })
          }
        }
        return events.length > 0 ? events : null
      }
    }

    // Claude Code headless: user message with tool_result
    if (type === 'user' && payload.message?.content) {
      const content = payload.message.content
      if (Array.isArray(content)) {
        const events: StreamEvent[] = []
        for (const block of content) {
          if (block.type === 'tool_result') {
            events.push({
              kind: 'tool_result',
              toolUseId: block.tool_use_id ?? '',
              result: block.content ?? '',
            })
          }
        }
        return events.length > 0 ? events : null
      }
    }

    // Legacy Claude CLI streaming events
    if (type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
      const text = typeof payload.delta.text === 'string' ? payload.delta.text : ''
      return text ? { kind: 'text', content: text } : null
    }

    // Thinking delta from streaming
    if (type === 'content_block_delta' && payload.delta?.type === 'thinking_delta') {
      const thinking = typeof payload.delta.thinking === 'string' ? payload.delta.thinking : ''
      return thinking ? { kind: 'thinking', content: thinking } : null
    }

    if (type === 'message_delta' && payload.delta?.usage) {
      const usage = payload.delta.usage
      const tokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0)
      return { kind: 'usage', tokens }
    }

    if (type === 'content_block_start' && payload.content_block?.type === 'tool_use') {
      const block = payload.content_block
      return {
        kind: 'tool_start',
        id: block.id ?? '',
        name: block.name ?? '',
        input: block.input ?? {},
      }
    }

    if (type === 'tool_result') {
      return {
        kind: 'tool_result',
        toolUseId: payload.tool_use_id ?? '',
        result: payload.result ?? payload.output ?? payload,
      }
    }

    if (type === 'message_stop' || type === 'response_end' || type === 'message_done') {
      const usage = payload.usage ?? payload.delta?.usage
      const totalTokens =
        (usage?.input_tokens ?? 0) +
        (usage?.output_tokens ?? 0) +
        (payload.total_tokens ?? payload.totalTokens ?? 0)

      return {
        kind: 'complete',
        cost: payload.cost ?? payload.estimated_cost ?? 0,
        durationMs: payload.duration_ms ?? payload.durationMs ?? 0,
        totalTokens,
        sessionId: payload.session_id,
      }
    }

    // Fallback: emit text if present
    if (typeof payload.text === 'string') {
      return { kind: 'text', content: payload.text }
    }

    return null
  }

  private normalizeKindPayload(payload: {
    kind: string
    [key: string]: unknown
  }): StreamEvent | StreamEvent[] | null {
    switch (payload.kind) {
      case 'init':
        return { kind: 'init', sessionId: String(payload.sessionId ?? '') }
      case 'text':
        return { kind: 'text', content: String(payload.content ?? payload.text ?? '') }
      case 'thinking':
        return { kind: 'thinking', content: String(payload.content ?? '') }
      case 'thinking_complete':
        return { kind: 'thinking_complete' }
      case 'tool_start':
        return {
          kind: 'tool_start',
          id: String(payload.id ?? ''),
          name: String(payload.name ?? ''),
          input: (payload.input as Record<string, unknown> | undefined) ?? {},
        }
      case 'tool_result':
        return {
          kind: 'tool_result',
          toolUseId: String(payload.toolUseId ?? payload.id ?? ''),
          result: payload.result,
        }
      case 'usage':
        return {
          kind: 'usage',
          tokens: Number(payload.tokens ?? payload.totalTokens ?? 0),
        }
      case 'complete':
        return {
          kind: 'complete',
          cost: Number(payload.cost ?? 0),
          durationMs: Number(payload.durationMs ?? 0),
          totalTokens: Number(payload.totalTokens ?? 0),
          sessionId: payload.sessionId as string | undefined,
        }
      default:
        return null
    }
  }
}
