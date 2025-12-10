import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface ClaudeSession {
  sessionId: string
  threadId: string
  createdAt: string
  lastUsedAt: string
}

interface ClaudeSessionStoreState {
  sessions: Record<string, ClaudeSession> // keyed by threadId
  loaded: boolean
}

interface ClaudeSessionStoreActions {
  loadSessions: () => void
  setSession: (threadId: string, sessionId: string) => void
  getSession: (threadId: string) => string | null
  clearSession: (threadId: string) => void
  clearAllSessions: () => void
}

type ClaudeSessionStore = ClaudeSessionStoreState & ClaudeSessionStoreActions

const SESSIONS_DIR = path.join(os.homedir(), '.sonder')
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'claude-sessions.json')

function ensureDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

function loadSessionsFromDisk(): Record<string, ClaudeSession> {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch {
    // Ignore errors, return empty
  }
  return {}
}

function saveSessionsToDisk(sessions: Record<string, ClaudeSession>): void {
  try {
    ensureDir()
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2))
  } catch {
    // Ignore write errors
  }
}

const initialState: ClaudeSessionStoreState = {
  sessions: {},
  loaded: false,
}

export const useClaudeSessionStore = create<ClaudeSessionStore>()(
  immer((set, get) => ({
    ...initialState,

    loadSessions: () => {
      const sessions = loadSessionsFromDisk()
      set((state) => {
        state.sessions = sessions
        state.loaded = true
      })
    },

    setSession: (threadId, sessionId) => {
      set((state) => {
        const existing = state.sessions[threadId]
        state.sessions[threadId] = {
          sessionId,
          threadId,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        }
      })
      // Persist to disk
      saveSessionsToDisk(get().sessions)
    },

    getSession: (threadId) => {
      const session = get().sessions[threadId]
      return session?.sessionId ?? null
    },

    clearSession: (threadId) => {
      set((state) => {
        delete state.sessions[threadId]
      })
      saveSessionsToDisk(get().sessions)
    },

    clearAllSessions: () => {
      set((state) => {
        state.sessions = {}
      })
      saveSessionsToDisk({})
    },
  }))
)
