import { spawn, type ChildProcess } from 'child_process'

interface CompleteStats {
  cost: number
  durationMs: number
  totalTokens: number
}

interface CodexServiceOptions {
  model: string
  onText: (text: string) => void
  onToolStart: (id: string, name: string, input: Record<string, unknown>) => void
  onToolResult: (toolUseId: string, result: unknown) => void
  onUsage: (tokens: number) => void
  onComplete: (stats: CompleteStats) => void
  onError: (error: Error) => void
}

/**
 * Lightweight Codex CLI streamer using `codex exec --json`
 * Tool events are ignored; only text/usage are surfaced.
 */
export class CodexService {
  private process: ChildProcess | null = null
  private canceled = false
  private buffer = ''

  async send(prompt: string, options: CodexServiceOptions): Promise<void> {
    if (this.process) {
      throw new Error('Codex is already running')
    }

    this.canceled = false
    let stderrBuffer = ''
    let tokenCount = 0
    let runError: Error | null = null

    const args = [
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
    ]

    const modelToUse = options.model?.trim()
    if (modelToUse) {
      args.push('--model', modelToUse)
    }

    args.push('-') // read prompt from stdin

    return new Promise<void>((resolve, reject) => {
      this.process = spawn('codex', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      // Write prompt to stdin then close
      try {
        this.process.stdin?.write(prompt)
        this.process.stdin?.end()
      } catch {
        // ignore write errors; handled in close/error handlers
      }

      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString()
        const lines = this.buffer.split(/\r?\n/)
        this.buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          let parsed: any
          try {
            parsed = JSON.parse(trimmed)
          } catch {
            continue
          }

          if (parsed?.type === 'error' && typeof parsed.message === 'string') {
            // Capture Codex error events surfaced on stdout
            runError = new Error(parsed.message)
          }

          const text = this.extractText(parsed)
          if (text) {
            options.onText(text)
          }

          const usage = this.extractUsage(parsed)
          if (usage !== null) {
            tokenCount = usage
            options.onUsage(tokenCount)
          }

          // Codex tool events are ignored for now
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        stderrBuffer += data.toString()
      })

      this.process.on('close', (code) => {
        this.cleanup()
        if (!this.canceled && code !== 0 && code !== null) {
          const errMsg = stderrBuffer.trim()
          let message = runError?.message || errMsg || `Codex CLI exited with code ${code}`
          if (!runError && !errMsg) {
            message += '. Common causes: missing Codex login/API key or invalid/unsupported model. Try SONDER_CODEX_MODEL=gpt-4o-mini.'
          }
          options.onError(new Error(message))
        } else if (runError) {
          options.onError(runError)
        } else {
          options.onComplete({
            cost: 0,
            durationMs: 0,
            totalTokens: tokenCount,
          })
        }
        resolve()
      })

      this.process.on('error', (err) => {
        this.cleanup()
        options.onError(err)
        reject(err)
      })
    })
  }

  cancel(): void {
    if (this.process) {
      this.canceled = true
      this.process.kill('SIGTERM')
      this.cleanup()
    }
  }

  isRunning(): boolean {
    return this.process !== null
  }

  private extractText(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null

    // Codex CLI JSON format: item.completed with item.type === 'agent_message'
    if (payload.type === 'item.completed' && payload.item?.type === 'agent_message') {
      if (typeof payload.item.text === 'string') {
        return payload.item.text
      }
    }

    // Codex event format (e.g., response.output_text.delta)
    if (typeof (payload as { type?: unknown }).type === 'string') {
      const type = (payload as { type: string }).type
      if (type === 'response.output_text.delta' && typeof (payload as { delta?: unknown }).delta === 'string') {
        return (payload as { delta: string }).delta
      }
      if (type === 'response.output_text.done' && typeof (payload as { text?: unknown }).text === 'string') {
        return (payload as { text: string }).text
      }
    }

    if (typeof payload.text === 'string') return payload.text
    if (typeof payload.delta === 'string') return payload.delta
    if (payload.delta && typeof payload.delta.text === 'string') return payload.delta.text
    if (payload.content) {
      if (typeof payload.content === 'string') return payload.content
      if (Array.isArray(payload.content)) {
        const texts = payload.content
          .map((item: unknown) => {
            if (typeof item === 'string') return item
            if (item && typeof (item as { text?: unknown }).text === 'string') return (item as { text: string }).text
            return null
          })
          .filter((v: string | null): v is string => Boolean(v))
        if (texts.length) return texts.join('')
      }
    }
    if (payload.message?.content) {
      const msgContent = payload.message.content
      if (typeof msgContent === 'string') return msgContent
      if (Array.isArray(msgContent)) {
        const texts = msgContent
          .map((item: unknown) => {
            if (typeof item === 'string') return item
            if (item && typeof (item as { text?: unknown }).text === 'string') return (item as { text: string }).text
            return null
          })
          .filter((v: string | null): v is string => Boolean(v))
        if (texts.length) return texts.join('')
      }
    }

    return null
  }

  private extractUsage(payload: any): number | null {
    // Codex CLI turn.completed with usage
    if (payload?.type === 'turn.completed' && payload.usage) {
      const usage = payload.usage
      const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0
      const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0
      return inputTokens + outputTokens
    }

    // Codex response.completed with usage
    if (typeof payload?.type === 'string' && payload.type === 'response.completed') {
      const usage = payload.response?.usage
      if (usage) {
        const promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? 0
        const completionTokens = usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens ?? 0
        const total = usage.total_tokens ?? usage.totalTokens ?? promptTokens + completionTokens
        if (typeof total === 'number') return total
      }
    }

    const usage = payload?.usage
    if (!usage || typeof usage !== 'object') return null

    const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens ?? 0
    const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens ?? 0
    const total = usage.total_tokens ?? usage.totalTokens ?? inputTokens + outputTokens
    return typeof total === 'number' ? total : null
  }

  private cleanup(): void {
    this.process = null
    this.buffer = ''
  }
}

export const codexService = new CodexService()
