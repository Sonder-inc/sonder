/**
 * Process Executor Utility
 *
 * Unified subprocess execution with timeout handling.
 * Used by CLI tool agents (nmap, gobuster, nikto, hydra, searchsploit).
 */

import { spawn } from 'child_process'

export interface ProcessResult {
  success: boolean
  output: string
  error?: string
  killed?: boolean
}

export interface ProcessOptions {
  /** Timeout in milliseconds (default: 120000 = 2 minutes) */
  timeoutMs?: number
  /** Custom success check function (receives exit code and output) */
  successCheck?: (code: number | null, output: string) => boolean
  /** Tool name for error messages */
  toolName?: string
}

/**
 * Execute a command with timeout and output collection
 */
export async function executeProcess(
  command: string,
  args: string[],
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const {
    timeoutMs = 120000,
    successCheck,
    toolName = command,
  } = options

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let killed = false

    const proc = spawn(command, args, {
      env: { ...process.env },
    })

    const timer = setTimeout(() => {
      killed = true
      proc.kill('SIGKILL')
    }, timeoutMs)

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
          output: stdout,
          error: `${toolName} timed out after ${timeoutMs / 1000}s`,
          killed: true,
        })
        return
      }

      // Use custom success check if provided, otherwise check exit code
      const isSuccess = successCheck
        ? successCheck(code, stdout)
        : code === 0 || stdout.length > 0

      resolve({
        success: isSuccess,
        output: stdout || stderr,
        error: !isSuccess && code !== 0 ? `Exit code ${code}` : undefined,
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        success: false,
        output: '',
        error: `Failed to run ${toolName}: ${err.message}. Is ${toolName} installed?`,
      })
    })
  })
}

/**
 * Create timeout based on scan type
 */
export function getTimeoutForScanType(scanType: string): number {
  switch (scanType) {
    case 'full':
      return 600000 // 10 min
    case 'vuln':
      return 300000 // 5 min
    default:
      return 120000 // 2 min
  }
}
