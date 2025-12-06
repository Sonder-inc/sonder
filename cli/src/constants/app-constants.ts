export const MODELS = ['sonder', 'opus 4.5', 'gpt5', 'g3 pro'] as const
export type ModelName = (typeof MODELS)[number]

export const MODEL_IDS: Record<ModelName, string> = {
  sonder: 'anthropic/claude-3.7-sonnet:thinking',
  'opus 4.5': 'anthropic/claude-opus-4.5',
  gpt5: 'openai/gpt-5.1',
  'g3 pro': 'google/gemini-3-pro-preview',
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
  { name: '/context', aliases: [], description: 'Visualize current context usage as a colored grid' },
  { name: '/doctor', aliases: [], description: 'Diagnose and verify your installation and settings' },
  { name: '/exit', aliases: ['quit'], description: 'Exit the REPL' },
  { name: '/init', aliases: [], description: 'Initialize sonder in current directory' },
  { name: '/login', aliases: ['logout'], description: 'Login or logout when already logged in' },
  { name: '/school', aliases: [], description: 'Hacking playground to rank up' },
]

// Thread/context menu items
export interface ContextItem {
  name: string
  label: string
}

export const CONTEXT_ITEMS: readonly ContextItem[] = [
  { name: '*context', label: 'context' },
  { name: '*fork', label: 'fork' },
  { name: '*switch', label: 'switch' },
]
