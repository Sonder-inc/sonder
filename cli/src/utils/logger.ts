/**
 * Agent Logger Utility
 *
 * Provides structured logging for agent execution with debug, info, warn, error levels.
 * Follows codebuff's logger pattern: (data: unknown, msg?: string) => void
 */

export type LoggerFn = (data: unknown, msg?: string) => void

export interface Logger {
  debug: LoggerFn
  info: LoggerFn
  warn: LoggerFn
  error: LoggerFn
}

/**
 * Create a logger instance for an agent
 */
export function createAgentLogger(agentName: string): Logger {
  const createLogMethod = (level: 'debug' | 'info' | 'warn' | 'error'): LoggerFn => {
    return (data: unknown, msg?: string) => {
      const timestamp = new Date().toISOString()
      const prefix = `[${timestamp}] [${agentName}:${level}]`

      if (msg) {
        console.log(prefix, msg, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
      } else {
        console.log(prefix, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
      }
    }
  }

  return {
    debug: createLogMethod('debug'),
    info: createLogMethod('info'),
    warn: createLogMethod('warn'),
    error: createLogMethod('error'),
  }
}

/**
 * No-op logger for when logging is disabled
 */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}
