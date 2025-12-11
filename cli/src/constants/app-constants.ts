export const MODELS = ['sonder', 'claude', 'gemini', 'codex', 'aider', 'warp'] as const
export type ModelName = (typeof MODELS)[number]

// Base model IDs (without thinking suffix)
// See https://openrouter.ai/models for valid IDs
export const MODEL_IDS: Record<ModelName, string> = {
  sonder: 'deepseek/deepseek-v3.2-speciale',
  claude: 'anthropic/claude-3.7-sonnet',
  gemini: 'google/gemini-2.0-flash-001',
  codex: 'openai/gpt-4o',
  aider: 'openai/gpt-4o-mini',
  warp: 'openai/gpt-4-turbo',
}

// Models that support thinking mode
export const THINKING_CAPABLE_MODELS: ModelName[] = ['claude']

// Models that use Claude Code headless instead of OpenRouter
export const CLAUDE_CODE_MODELS: ModelName[] = ['claude']

export function usesClaudeCode(model: ModelName): boolean {
  return CLAUDE_CODE_MODELS.includes(model)
}

// Models that use Codex CLI headless instead of OpenRouter
export const CODEX_MODELS: ModelName[] = ['codex']

export function usesCodex(model: ModelName): boolean {
  return CODEX_MODELS.includes(model)
}

// Context limits per model (keyed by API model ID)
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'anthropic/claude-3.7-sonnet': 200_000,
  'anthropic/claude-3-5-haiku': 200_000,
  'openai/gpt-4o': 128_000,
  'openai/gpt-4o-mini': 128_000,
  'openai/gpt-4-turbo': 128_000,
  'google/gemini-2.0-flash-001': 1_000_000,
  'deepseek/deepseek-v3.2-speciale': 64_000,
}

export const DEFAULT_CONTEXT_LIMIT = 200_000

export function getModelId(model: ModelName, thinkingEnabled: boolean): string {
  const baseId = MODEL_IDS[model]
  if (thinkingEnabled && THINKING_CAPABLE_MODELS.includes(model)) {
    return `${baseId}:thinking`
  }
  return baseId
}

// Modes accessible via Shift+M cycling
export const CYCLABLE_MODES = ['stealth', 'osint', 'accept', 'kill'] as const
// All modes including special ones (school only via /school command)
export const MODES = [...CYCLABLE_MODES, 'school'] as const
export type ModeName = (typeof MODES)[number]

// Command definitions for the command menu
export interface Command {
  name: string
  aliases: readonly string[]
  description: string
}

export const COMMANDS: readonly Command[] = [
  { name: '/add-dir', aliases: [], description: 'Add a new working directory' },
  { name: '/agents', aliases: [], description: 'Manage agent configurations' },
  { name: '/clear', aliases: ['reset', 'new'], description: 'Start fresh conversation (new thread, no history)' },
  { name: '/config', aliases: ['theme'], description: 'Open config panel' },
  { name: '/context', aliases: ['status'], description: 'Show context usage, extensions, and session info' },
  { name: '/doctor', aliases: [], description: 'Diagnose and verify your installation and settings' },
  { name: '/exit', aliases: ['quit'], description: 'Exit the REPL' },
  { name: '/init', aliases: [], description: 'Initialize sonder in current directory' },
  { name: '/logout', aliases: [], description: 'Logout from platform accounts' },
  { name: '/school', aliases: [], description: 'Hacking playground to rank up' },
  { name: '/feedback', aliases: [], description: 'Submit feedback or report a bug' },
]

// Thread/context menu items
export interface ContextItem {
  name: string
  label: string
}

export const CONTEXT_ITEMS: readonly ContextItem[] = [
  { name: '*compact', label: 'compact' },
  { name: '*delete', label: 'delete' },
  { name: '*fork', label: 'fork' },
  { name: '*switch', label: 'switch' },
]
