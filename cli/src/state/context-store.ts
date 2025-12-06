import { create } from 'zustand'
import { MODEL_IDS, MODEL_CONTEXT_LIMITS, DEFAULT_CONTEXT_LIMIT, type ModelName } from '../constants/app-constants'
import { estimateTokens } from '../utils/tokens'

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
    const limit = MODEL_CONTEXT_LIMITS[state.currentModel] || DEFAULT_CONTEXT_LIMIT
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

// Re-export from utils for backwards compatibility
export { formatTokens, calculateMessageTokens } from '../utils/tokens'
