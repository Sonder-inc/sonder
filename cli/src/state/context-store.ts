import { create } from 'zustand'
import { MODEL_IDS, type ModelName } from '../constants/app-constants'

/**
 * Rough token estimation (4 chars ≈ 1 token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Context limits per model
 */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'anthropic/claude-3.7-sonnet:thinking': 200_000,
  'anthropic/claude-opus-4.5': 200_000,
  'openai/gpt-5.1': 128_000,
  'google/gemini-3-pro-preview': 1_000_000,
}

export interface ContextUsage {
  systemPrompt: number
  tools: number
  messages: number
  total: number
  limit: number
  percentage: number
}

interface ContextStoreState {
  currentModel: string
  systemPromptTokens: number
  toolsTokens: number
  messageTokens: number
}

interface ContextStoreActions {
  setModel: (model: string) => void
  setSystemPromptTokens: (tokens: number) => void
  setToolsTokens: (tokens: number) => void
  addMessageTokens: (tokens: number) => void
  setMessageTokens: (tokens: number) => void
  getUsage: () => ContextUsage
  reset: () => void
}

type ContextStore = ContextStoreState & ContextStoreActions

const DEFAULT_SYSTEM_PROMPT_TOKENS = 500
const DEFAULT_TOOLS_TOKENS = 2000

const initialState: ContextStoreState = {
  currentModel: MODEL_IDS.sonder,
  systemPromptTokens: DEFAULT_SYSTEM_PROMPT_TOKENS,
  toolsTokens: DEFAULT_TOOLS_TOKENS,
  messageTokens: 0,
}

export const useContextStore = create<ContextStore>((set, get) => ({
  ...initialState,

  setModel: (model) => set({ currentModel: model }),

  setSystemPromptTokens: (tokens) => set({ systemPromptTokens: tokens }),

  setToolsTokens: (tokens) => set({ toolsTokens: tokens }),

  addMessageTokens: (tokens) =>
    set((state) => ({ messageTokens: state.messageTokens + tokens })),

  setMessageTokens: (tokens) => set({ messageTokens: tokens }),

  getUsage: () => {
    const state = get()
    const limit = MODEL_CONTEXT_LIMITS[state.currentModel] || 200_000
    const total = state.systemPromptTokens + state.toolsTokens + state.messageTokens
    return {
      systemPrompt: state.systemPromptTokens,
      tools: state.toolsTokens,
      messages: state.messageTokens,
      total,
      limit,
      percentage: Math.round((total / limit) * 100),
    }
  },

  reset: () => set({ messageTokens: 0 }),
}))

/**
 * Calculate token usage from messages array
 */
export function calculateMessageTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((acc, msg) => acc + estimateTokens(msg.content), 0)
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`
  }
  return tokens.toString()
}
