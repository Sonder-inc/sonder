export const MODELS = ['Sonder', 'Opus 4.5', 'GPT5', 'G3 Pro'] as const
export type ModelName = (typeof MODELS)[number]

export const MODEL_IDS: Record<ModelName, string> = {
  Sonder: 'anthropic/claude-3.7-sonnet:thinking',
  'Opus 4.5': 'anthropic/claude-opus-4.5',
  GPT5: 'openai/gpt-5.1',
  'G3 Pro': 'google/gemini-3-pro-preview',
}

export const MODES = ['stealth', 'osint', 'accept', 'kill'] as const
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
  { name: '/login', aliases: ['logout'], description: 'Login or logout when already logged in' },
  { name: '/school', aliases: [], description: 'Hacking playground to rank up' },
]

// Thread/context menu items
export interface ContextItem {
  name: string
  label: string
}

export const CONTEXT_ITEMS: readonly ContextItem[] = [
  { name: '*switch', label: 'switch' },
  { name: '*previous', label: 'previous' },
  { name: '*parent', label: 'parent' },
  { name: '*editor', label: 'editor' },
  { name: '*browser', label: 'browser' },
  { name: '*copy', label: 'copy' },
  { name: '*think?', label: 'think?' },
  { name: '*support', label: 'support' },
  { name: '*new', label: 'new' },
  { name: '*handoff', label: 'handoff' },
  { name: '*fork', label: 'fork' },
]
