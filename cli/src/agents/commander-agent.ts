/**
 * Commander Agent - Shell Command Execution
 *
 * Executes shell commands with safety checks.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/,
  /mkfs/,
  /dd\s+if=.*of=\/dev/,
  />\s*\/dev\/sd/,
  /chmod\s+-R\s+777\s+\//,
  /:\(\)\s*\{\s*:\|:&\s*\};\s*:/,  // fork bomb
]

const commanderParams = z.object({
  command: z.string().describe('Shell command to execute'),
  cwd: z.string().optional().describe('Working directory'),
  timeout: z.number().optional().default(30000).describe('Timeout in ms'),
})

type CommanderParams = z.infer<typeof commanderParams>

export interface CommanderResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

export const commanderAgent = defineAgent<typeof commanderParams, CommanderResult>({
  name: 'commander',
  description: 'Execute shell commands. Use for running tools, scripts, and system operations.',
  systemPrompt: '',
  parameters: commanderParams,

  async execute(params: CommanderParams): Promise<AgentResult<CommanderResult>> {
    // Safety check
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(params.command)) {
        return {
          success: false,
          summary: 'Blocked: dangerous command',
          data: {
            command: params.command,
            stdout: '',
            stderr: 'Command blocked for safety',
            exitCode: 1,
          },
        }
      }
    }

    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd: params.cwd,
        timeout: params.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })

      const truncatedStdout = stdout.length > 5000
        ? stdout.slice(0, 5000) + '\n...[truncated]'
        : stdout

      return {
        success: true,
        summary: stdout ? `Output: ${stdout.split('\n')[0].slice(0, 50)}...` : 'Command completed',
        data: {
          command: params.command,
          stdout: truncatedStdout,
          stderr,
          exitCode: 0,
        },
      }
    } catch (err: any) {
      return {
        success: false,
        summary: err.message?.slice(0, 100) || 'Command failed',
        data: {
          command: params.command,
          stdout: err.stdout || '',
          stderr: err.stderr || err.message || '',
          exitCode: err.code || 1,
        },
      }
    }
  },
})
