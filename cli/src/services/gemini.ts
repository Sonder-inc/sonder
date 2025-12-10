import { spawn, type ChildProcess } from 'child_process'

interface CompleteStats {
  cost: number
  durationMs: number
  totalTokens: number
}

interface GeminiServiceOptions {
  model: string
  onText: (text: string) => void
  onToolStart: (id: string, name: string, input: Record<string, unknown>) => void
  onToolResult: (toolUseId: string, result: unknown) => void
  onUsage: (tokens: number) => void
  onComplete: (stats: CompleteStats) => void
  onError: (error: Error) => void
}

/**
 * Minimal Gemini CLI streamer using `--output-format stream-json`.
 * Tool events are ignored; only text/usage are surfaced.
 */
export class GeminiService {
  private process: ChildProcess | null = null
  private canceled = false
  private buffer = ''

  async send(prompt: string, options: GeminiServiceOptions): Promise<void> {
    if (this.process) {
      throw new Error('Gemini is already running')
    }

    this.canceled = false
    let stderrBuffer = ''
    let tokenCount = 0

    const args = [
      '--output-format',
      'stream-json',
      '--approval-mode',
      'yolo',
      '--sandbox=false',
    ]

    const modelToUse = options.model?.trim()
    if (modelToUse) {
      args.push('--model', modelToUse)
    }

    args.push(prompt)

    return new Promise<void>((resolve, reject) => {
      this.process = spawn('gemini', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

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

          const text = this.extractText(parsed)
          if (text) {
            options.onText(text)
          }

          const usage = this.extractUsage(parsed)
          if (usage !== null) {
            tokenCount = usage
            options.onUsage(tokenCount)
          }

          // Tool events ignored for now
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        stderrBuffer += data.toString()
      })

      this.process.on('close', (code) => {
        this.cleanup()
        if (!this.canceled && code !== 0 && code !== null) {
          const errMsg = stderrBuffer.trim()
          let message = `Gemini CLI exited with code ${code}`
          if (errMsg) {
            message += `: ${errMsg}`
          } else {
            message += '. Common causes: not logged in or invalid model name.'
          }
          if (/not found/i.test(errMsg) || /ModelNotFoundError/i.test(errMsg)) {
            message += ' Try setting SONDER_GEMINI_MODEL=gemini-1.5-flash-latest.'
          }
          options.onError(new Error(message))
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
    const usage = payload?.usage
    if (!usage || typeof usage !== 'object') return null

    const promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? 0
    const completionTokens = usage.completion_tokens ?? usage.completionTokens ?? 0
    const total = usage.total_tokens ?? usage.totalTokens ?? promptTokens + completionTokens
    return typeof total === 'number' ? total : null
  }

  private cleanup(): void {
    this.process = null
    this.buffer = ''
  }
}

export const geminiService = new GeminiService()
