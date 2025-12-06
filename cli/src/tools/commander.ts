import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { spawn } from 'child_process'

const commanderParams = z.object({
  command: z.string().describe('Shell command to execute'),
  cwd: z.string().optional().describe('Working directory'),
  timeout: z.number().optional().default(30000).describe('Timeout in ms (default 30s)'),
})

// Blocklist of dangerous commands for safety
const BLOCKED_PATTERNS = [
  /^rm\s+(-rf?|--recursive)?\s*\//, // rm -rf /
  /^sudo\s+rm/,
  /^chmod\s+777\s*\//,
  /^mkfs\./,
  /:\(\)\{:\|:&\};:/, // fork bomb
  />\s*\/dev\/sd[a-z]/, // overwrite disk
  /dd\s+.*of=\/dev\/sd[a-z]/, // dd to disk
]

function isBlockedCommand(cmd: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(cmd))
}

export const commander = defineTool({
  name: 'shell',
  description: 'Execute shell commands. Returns stdout/stderr. Use for running tools, scripts, or system commands.',
  parameters: commanderParams,
  execute: async ({ command, cwd, timeout }): Promise<ToolResult> => {
    // Safety check
    if (isBlockedCommand(command)) {
      return {
        success: false,
        summary: 'Command blocked',
        fullResult: 'This command pattern is blocked for safety reasons.',
      }
    }

    const workDir = cwd || process.cwd()

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let killed = false

      const proc = spawn('sh', ['-c', command], {
        cwd: workDir,
        env: { ...process.env },
        timeout,
      })

      const timer = setTimeout(() => {
        killed = true
        proc.kill('SIGKILL')
      }, timeout)

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        clearTimeout(timer)

        if (killed) {
          resolve({
            success: false,
            summary: 'Timeout',
            fullResult: `Command timed out after ${timeout}ms\n\nPartial output:\n${stdout}\n\nStderr:\n${stderr}`,
          })
          return
        }

        const success = code === 0
        const output = stdout || stderr || '(no output)'

        // Truncate very long outputs
        const maxLen = 10000
        const truncated = output.length > maxLen
          ? output.slice(0, maxLen) + '\n...[truncated]'
          : output

        resolve({
          success,
          summary: success ? 'OK' : `Exit ${code}`,
          fullResult: truncated,
        })
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        resolve({
          success: false,
          summary: 'Failed to run',
          fullResult: `Error: ${err.message}`,
        })
      })
    })
  },
})
