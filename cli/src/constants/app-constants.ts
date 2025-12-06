export const MODELS = ['sonder', 'opus 4.5', 'gpt5', 'g3 pro'] as const
export type ModelName = (typeof MODELS)[number]

// Base model IDs (without thinking suffix)
export const MODEL_IDS: Record<ModelName, string> = {
  sonder: 'anthropic/claude-3.7-sonnet',
  'opus 4.5': 'anthropic/claude-opus-4.5',
  gpt5: 'openai/gpt-5.1',
  'g3 pro': 'google/gemini-3-pro-preview',
}

// Models that support thinking mode
export const THINKING_CAPABLE_MODELS: ModelName[] = ['sonder']

// Context limits per model (keyed by API model ID)
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'anthropic/claude-3.7-sonnet': 200_000,
  'anthropic/claude-3.7-sonnet:thinking': 200_000,
  'anthropic/claude-opus-4.5': 200_000,
  'openai/gpt-5.1': 128_000,
  'google/gemini-3-pro-preview': 1_000_000,
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
  { name: '/clear', aliases: ['reset', 'new'], description: 'Clear conversation history and free up context' },
  { name: '/config', aliases: ['theme'], description: 'Open config panel' },
  { name: '/context', aliases: ['status'], description: 'Show context usage, extensions, and session info' },
  { name: '/doctor', aliases: [], description: 'Diagnose and verify your installation and settings' },
  { name: '/exit', aliases: ['quit'], description: 'Exit the REPL' },
  { name: '/init', aliases: [], description: 'Initialize sonder in current directory' },
  { name: '/login', aliases: ['logout'], description: 'Login or logout when already logged in' },
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
  { name: '*fork', label: 'fork' },
  { name: '*switch', label: 'switch' },
]
