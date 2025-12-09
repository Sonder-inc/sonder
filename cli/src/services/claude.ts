import { spawn, type ChildProcess } from 'child_process'

interface CompleteStats {
  cost: number
  durationMs: number
  totalTokens: number
  sessionId?: string
}

interface ClaudeServiceOptions {
  model: string
  sessionId?: string  // For resuming conversations
  onText: (text: string) => void
  onToolStart: (id: string, name: string, input: Record<string, unknown>) => void
  onToolResult: (toolUseId: string, result: unknown) => void
  onThinking?: (text: string) => void
  onThinkingComplete?: () => void
  onInit?: (sessionId: string) => void
  onUsage: (tokens: number) => void
  onComplete: (stats: CompleteStats) => void
  onError: (error: Error) => void
}

export class ClaudeService {
  private process: ChildProcess | null = null
  private canceled = false

  async send(prompt: string, options: ClaudeServiceOptions): Promise<void> {
    if (this.process) {
      throw new Error('Claude is already running')
    }

    // Note: Claude Code handles auth via `claude login` - no env var needed
    this.canceled = false
    let stderrBuffer = ''

    // Build args - use raw text output for real-time streaming
    const args: string[] = []

    // Add --resume if we have a session to continue
    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    }

    args.push(
      '-p',
      prompt,
      '--dangerously-skip-permissions',
      '--output-format', 'stream-json',
      '--verbose',
    )

    // Only add model if not resuming (resumed sessions use their original model)
    if (!options.sessionId && options.model) {
      args.push('--model', options.model)
    }

    return new Promise<void>((resolve, reject) => {
      this.process = spawn('claude', args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '1', TERM: 'xterm-256color' }
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        options.onText(data.toString())
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        stderrBuffer += data.toString()
      })

      this.process.on('close', (code) => {
        this.cleanup()
        if (!this.canceled && code !== 0 && code !== null) {
          const errMsg = stderrBuffer.trim()
          let message = `Claude CLI exited with code ${code}`
          if (errMsg) {
            message += `: ${errMsg}`
          } else {
            message += '. Common causes: not logged in (`claude login`), or invalid model name.'
          }
          const error = new Error(message)
          options.onError(error)
        } else if (!this.canceled) {
          // Successfully completed
          options.onComplete({
            cost: 0,
            durationMs: 0,
            totalTokens: 0,
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

  private cleanup(): void {
    this.process = null
  }
}

export const claudeService = new ClaudeService()
