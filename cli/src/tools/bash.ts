/**
 * Run Terminal Command Tool
 *
 * Executes shell commands with safety checks.
 * Extracted from commander-agent for reuse by any agent.
 */

import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/,
  /mkfs/,
  /dd\s+if=.*of=\/dev/,
  />\s*\/dev\/sd/,
  /chmod\s+-R\s+777\s+\//,
  /:\(\)\s*\{\s*:\|:&\s*\};\s*:/, // fork bomb
]

const runTerminalCommandParams = z.object({
  command: z.string().describe('Shell command to execute'),
  working_directory: z.string().optional().describe('Working directory for command execution'),
  timeout_seconds: z.number().optional().default(30).describe('Timeout in seconds (-1 for no timeout)'),
})

export const Bash = defineTool({
  name: 'Bash',
  description: 'Execute a shell command and return its output. Use for running tools, scripts, and system operations.',
  parameters: runTerminalCommandParams,

  async execute({ command, working_directory, timeout_seconds }): Promise<ToolResult> {
    // Safety check
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return {
          success: false,
          summary: 'Blocked: dangerous command pattern detected',
          fullResult: `Command blocked for safety: ${command}`,
          displayName: 'Terminal',
          displayInput: command,
          displayColor: 'error',
        }
      }
    }

    const timeout = timeout_seconds === -1 ? undefined : timeout_seconds * 1000

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: working_directory,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })

      const truncatedStdout =
        stdout.length > 5000 ? stdout.slice(0, 5000) + '\n...[truncated]' : stdout

      const hasStderr = stderr && stderr.trim().length > 0
      const fullResult = hasStderr
        ? `STDOUT:\n${truncatedStdout}\n\nSTDERR:\n${stderr}`
        : truncatedStdout

      return {
        success: true,
        summary: stdout
          ? `Output: ${stdout.split('\n')[0].slice(0, 60)}${stdout.split('\n')[0].length > 60 ? '...' : ''}`
          : 'Command completed successfully',
        fullResult,
        displayName: 'Terminal',
        displayInput: command,
        displayColor: 'success',
      }
    } catch (err: any) {
      const stdout = err.stdout || ''
      const stderr = err.stderr || err.message || 'Unknown error'

      return {
        success: false,
        summary: `Exit ${err.code || 1}: ${stderr.split('\n')[0].slice(0, 60)}`,
        fullResult: `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nExit code: ${err.code || 1}`,
        displayName: 'Terminal',
        displayInput: command,
        displayColor: 'error',
      }
    }
  },
})
