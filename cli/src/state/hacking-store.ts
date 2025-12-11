/**
 * Hacking Mode Store
 *
 * Manages the state for hacking mode:
 * - Recon findings (ports, services, tech)
 * - Credentials and secrets
 * - Active target session state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type ReconType = 'port' | 'service' | 'subdomain' | 'directory' | 'tech' | 'os' | 'vulnerability'

export interface ReconFinding {
  id: string
  type: ReconType
  value: string
  details?: string
  timestamp: Date
}

export type CredentialType = 'username' | 'password' | 'hash' | 'api_key' | 'token' | 'ssh_key' | 'certificate'

export interface Credential {
  id: string
  type: CredentialType
  value: string
  source?: string // Where found (e.g., "SQL injection", "/etc/passwd")
  user?: string // Associated username
  service?: string // SSH, MySQL, etc.
  cracked?: boolean
  timestamp: Date
}

export type AttackPhase = 'recon' | 'exploit' | 'post-exploit' | 'reporting'

export interface HackingSession {
  target: string | null // IP or hostname
  targetName?: string // Human-friendly name
  startTime: Date | null
  currentPhase: AttackPhase
  hasUserFlag: boolean
  hasRootFlag: boolean
  hasShell: boolean
  shellType?: 'user' | 'root'
}

interface HackingStoreState {
  // Recon findings
  findings: ReconFinding[]

  // Credentials and secrets
  credentials: Credential[]

  // Active session
  session: HackingSession

  // Navigation state for sidebar sections
  selectedFindingIndex: number
  selectedCredentialIndex: number

  // UI state
  sidebarFocused: boolean
}

interface HackingStoreActions {
  // Recon findings
  addFinding: (finding: Omit<ReconFinding, 'id' | 'timestamp'>) => void
  removeFinding: (id: string) => void
  clearFindings: () => void
  getFindingsByType: (type: ReconType) => ReconFinding[]

  // Credentials
  addCredential: (credential: Omit<Credential, 'id' | 'timestamp'>) => void
  removeCredential: (id: string) => void
  clearCredentials: () => void
  markCredentialCracked: (id: string, cracked: boolean) => void
  getCredentialsByType: (type: CredentialType) => Credential[]

  // Session
  startSession: (target: string, targetName?: string) => void
  endSession: () => void
  setPhase: (phase: AttackPhase) => void
  markUserFlag: (hasFlag: boolean) => void
  markRootFlag: (hasFlag: boolean) => void
  setShell: (hasShell: boolean, shellType?: 'user' | 'root') => void
  getSessionDuration: () => number // seconds

  // Navigation
  navigateFindingUp: () => void
  navigateFindingDown: () => void
  navigateCredentialUp: () => void
  navigateCredentialDown: () => void
  getSelectedFinding: () => ReconFinding | null
  getSelectedCredential: () => Credential | null

  // UI
  setSidebarFocused: (focused: boolean) => void

  // Reset
  reset: () => void
}

type HackingStore = HackingStoreState & HackingStoreActions

const initialState: HackingStoreState = {
  findings: [],
  credentials: [],
  session: {
    target: null,
    targetName: undefined,
    startTime: null,
    currentPhase: 'recon',
    hasUserFlag: false,
    hasRootFlag: false,
    hasShell: false,
    shellType: undefined,
  },
  selectedFindingIndex: 0,
  selectedCredentialIndex: 0,
  sidebarFocused: false,
}

export const useHackingStore = create<HackingStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // ─── Recon Findings ───────────────────────────────────────────────────────

      addFinding: (finding) =>
        set((state) => {
          const newFinding: ReconFinding = {
            ...finding,
            id: `finding-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            timestamp: new Date(),
          }
          state.findings.push(newFinding)
        }),

      removeFinding: (id) =>
        set((state) => {
          state.findings = state.findings.filter((f) => f.id !== id)
          // Adjust selected index if needed
          if (state.selectedFindingIndex >= state.findings.length) {
            state.selectedFindingIndex = Math.max(0, state.findings.length - 1)
          }
        }),

      clearFindings: () =>
        set((state) => {
          state.findings = []
          state.selectedFindingIndex = 0
        }),

      getFindingsByType: (type) => {
        return get().findings.filter((f) => f.type === type)
      },

      // ─── Credentials ──────────────────────────────────────────────────────────

      addCredential: (credential) =>
        set((state) => {
          const newCredential: Credential = {
            ...credential,
            id: `cred-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            timestamp: new Date(),
          }
          state.credentials.push(newCredential)
        }),

      removeCredential: (id) =>
        set((state) => {
          state.credentials = state.credentials.filter((c) => c.id !== id)
          // Adjust selected index if needed
          if (state.selectedCredentialIndex >= state.credentials.length) {
            state.selectedCredentialIndex = Math.max(0, state.credentials.length - 1)
          }
        }),

      clearCredentials: () =>
        set((state) => {
          state.credentials = []
          state.selectedCredentialIndex = 0
        }),

      markCredentialCracked: (id, cracked) =>
        set((state) => {
          const cred = state.credentials.find((c) => c.id === id)
          if (cred) {
            cred.cracked = cracked
          }
        }),

      getCredentialsByType: (type) => {
        return get().credentials.filter((c) => c.type === type)
      },

      // ─── Session ──────────────────────────────────────────────────────────────

      startSession: (target, targetName) =>
        set((state) => {
          state.session.target = target
          state.session.targetName = targetName
          state.session.startTime = new Date()
          state.session.currentPhase = 'recon'
          state.session.hasUserFlag = false
          state.session.hasRootFlag = false
          state.session.hasShell = false
          state.session.shellType = undefined
        }),

      endSession: () =>
        set((state) => {
          state.session.target = null
          state.session.targetName = undefined
          state.session.startTime = null
          state.session.currentPhase = 'recon'
          state.session.hasUserFlag = false
          state.session.hasRootFlag = false
          state.session.hasShell = false
          state.session.shellType = undefined
          // Optionally clear findings/credentials
          // state.findings = []
          // state.credentials = []
        }),

      setPhase: (phase) =>
        set((state) => {
          state.session.currentPhase = phase
        }),

      markUserFlag: (hasFlag) =>
        set((state) => {
          state.session.hasUserFlag = hasFlag
        }),

      markRootFlag: (hasFlag) =>
        set((state) => {
          state.session.hasRootFlag = hasFlag
        }),

      setShell: (hasShell, shellType) =>
        set((state) => {
          state.session.hasShell = hasShell
          state.session.shellType = shellType
        }),

      getSessionDuration: () => {
        const state = get()
        if (!state.session.startTime) return 0
        return Math.floor((Date.now() - new Date(state.session.startTime).getTime()) / 1000)
      },

      // ─── Navigation ───────────────────────────────────────────────────────────

      navigateFindingUp: () =>
        set((state) => {
          state.selectedFindingIndex = Math.max(0, state.selectedFindingIndex - 1)
        }),

      navigateFindingDown: () => {
        const findings = get().findings
        set((state) => {
          const maxIndex = findings.length - 1
          state.selectedFindingIndex = Math.min(maxIndex, state.selectedFindingIndex + 1)
        })
      },

      navigateCredentialUp: () =>
        set((state) => {
          state.selectedCredentialIndex = Math.max(0, state.selectedCredentialIndex - 1)
        }),

      navigateCredentialDown: () => {
        const credentials = get().credentials
        set((state) => {
          const maxIndex = credentials.length - 1
          state.selectedCredentialIndex = Math.min(maxIndex, state.selectedCredentialIndex + 1)
        })
      },

      getSelectedFinding: () => {
        const state = get()
        return state.findings[state.selectedFindingIndex] || null
      },

      getSelectedCredential: () => {
        const state = get()
        return state.credentials[state.selectedCredentialIndex] || null
      },

      // ─── UI ───────────────────────────────────────────────────────────────────

      setSidebarFocused: (focused) =>
        set((state) => {
          state.sidebarFocused = focused
        }),

      // ─── Reset ────────────────────────────────────────────────────────────────

      reset: () =>
        set((state) => {
          Object.assign(state, initialState)
        }),
    })),
    {
      name: 'sonder-hacking-state',
      // Persist everything
      partialize: (state) => ({
        findings: state.findings,
        credentials: state.credentials,
        session: state.session,
      }),
    }
  )
)
