/**
 * Runtime scope/mode configuration for sonder CLI
 * Determines whether to run in interactive (TUI) or headless (CI/CD) mode
 */

export type SonderScope = 'interactive' | 'headless'

export interface HeadlessConfig {
  prompt: string
  model?: string
  timeout?: number
}

export interface ScopeConfig {
  scope: SonderScope
  initialPrompt?: string
  headless?: HeadlessConfig
}

// Global scope state (set once at startup)
let currentScope: ScopeConfig = { scope: 'interactive' }

/**
 * Parse CLI arguments to determine scope
 * Handles: --headless, --model, --timeout flags
 */
export function parseScope(argv: string[]): ScopeConfig {
  const args = argv.slice(2) // Remove node/bun and script path

  const headlessIndex = args.indexOf('--headless')
  const isHeadless = headlessIndex !== -1

  if (!isHeadless) {
    // Interactive mode - collect remaining args as initial prompt
    const prompt = args.join(' ').trim()
    currentScope = {
      scope: 'interactive',
      initialPrompt: prompt || undefined,
    }
    return currentScope
  }

  // Headless mode - parse options
  let model: string | undefined
  let timeout: number | undefined
  const promptParts: string[] = []

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    if (arg === '--headless') {
      i++
      continue
    }

    if (arg === '--model' && args[i + 1]) {
      model = args[i + 1]
      i += 2
      continue
    }

    if (arg === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1], 10)
      i += 2
      continue
    }

    // Everything else is part of the prompt
    promptParts.push(arg)
    i++
  }

  currentScope = {
    scope: 'headless',
    headless: {
      prompt: promptParts.join(' '),
      model,
      timeout: timeout || 300000, // Default 5 minutes
    },
  }

  return currentScope
}

/**
 * Check if running in headless mode
 */
export function isHeadless(): boolean {
  return currentScope.scope === 'headless'
}

/**
 * Get current scope config
 */
export function getScope(): ScopeConfig {
  return currentScope
}

/**
 * Read prompt from stdin (for piping)
 */
export async function readStdinPrompt(): Promise<string> {
  // Check if stdin has data (is being piped)
  if (process.stdin.isTTY) {
    return ''
  }

  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data.trim())
    })
    // Timeout for stdin read
    setTimeout(() => resolve(data.trim()), 100)
  })
}
