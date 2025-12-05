import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type {
  Machine,
  ChatMessage,
  PvPMatch,
  User,
  SidebarTab,
  MachineStatus,
} from '../types/platform'

export interface PlatformStoreState {
  // Auth
  isAuthenticated: boolean
  user: User | null

  // Machines
  machines: Machine[]
  activeMachine: Machine | null
  machineStatus: MachineStatus

  // Chat/hints
  chatMessages: ChatMessage[]
  unreadHintCount: number
  revealedSpoilerLevels: Set<string> // hint IDs that user has revealed

  // PvP
  activeMatch: PvPMatch | null
  availableMatches: PvPMatch[]

  // UI
  sidebarTab: SidebarTab
  isLoadingMachines: boolean
  isSpawning: boolean
}

interface PlatformStoreActions {
  // Auth
  setUser: (user: User | null) => void
  setAuthenticated: (isAuthenticated: boolean) => void

  // Machines
  setMachines: (machines: Machine[]) => void
  setActiveMachine: (machine: Machine | null) => void
  setMachineStatus: (status: MachineStatus) => void
  updateMachine: (id: string, updates: Partial<Machine>) => void
  setIsLoadingMachines: (loading: boolean) => void
  setIsSpawning: (spawning: boolean) => void

  // Chat/hints
  setChatMessages: (messages: ChatMessage[]) => void
  addChatMessage: (message: ChatMessage) => void
  revealSpoiler: (hintId: string) => void
  clearUnreadHints: () => void

  // PvP
  setActiveMatch: (match: PvPMatch | null) => void
  setAvailableMatches: (matches: PvPMatch[]) => void
  updateMatch: (id: string, updates: Partial<PvPMatch>) => void

  // UI
  setSidebarTab: (tab: SidebarTab) => void

  // Reset
  reset: () => void
}

type PlatformStore = PlatformStoreState & PlatformStoreActions

const initialState: PlatformStoreState = {
  isAuthenticated: false,
  user: null,
  machines: [],
  activeMachine: null,
  machineStatus: 'offline',
  chatMessages: [],
  unreadHintCount: 0,
  revealedSpoilerLevels: new Set(),
  activeMatch: null,
  availableMatches: [],
  sidebarTab: 'vm',
  isLoadingMachines: false,
  isSpawning: false,
}

export const usePlatformStore = create<PlatformStore>()(
  immer((set) => ({
    ...initialState,

    // Auth
    setUser: (user) =>
      set((state) => {
        state.user = user
        state.isAuthenticated = user !== null
      }),

    setAuthenticated: (isAuthenticated) =>
      set((state) => {
        state.isAuthenticated = isAuthenticated
      }),

    // Machines
    setMachines: (machines) =>
      set((state) => {
        state.machines = machines
      }),

    setActiveMachine: (machine) =>
      set((state) => {
        state.activeMachine = machine
        state.machineStatus = machine?.status || 'offline'
        // Clear hints when switching machines
        state.chatMessages = []
        state.revealedSpoilerLevels = new Set()
      }),

    setMachineStatus: (status) =>
      set((state) => {
        state.machineStatus = status
        if (state.activeMachine) {
          state.activeMachine.status = status
        }
      }),

    updateMachine: (id, updates) =>
      set((state) => {
        const machine = state.machines.find((m) => m.id === id)
        if (machine) {
          Object.assign(machine, updates)
        }
        if (state.activeMachine?.id === id) {
          Object.assign(state.activeMachine, updates)
        }
      }),

    setIsLoadingMachines: (loading) =>
      set((state) => {
        state.isLoadingMachines = loading
      }),

    setIsSpawning: (spawning) =>
      set((state) => {
        state.isSpawning = spawning
      }),

    // Chat/hints
    setChatMessages: (messages) =>
      set((state) => {
        state.chatMessages = messages
      }),

    addChatMessage: (message) =>
      set((state) => {
        state.chatMessages.push(message)
        if (message.type === 'hint') {
          state.unreadHintCount += 1
        }
      }),

    revealSpoiler: (hintId) =>
      set((state) => {
        state.revealedSpoilerLevels.add(hintId)
      }),

    clearUnreadHints: () =>
      set((state) => {
        state.unreadHintCount = 0
      }),

    // PvP
    setActiveMatch: (match) =>
      set((state) => {
        state.activeMatch = match
      }),

    setAvailableMatches: (matches) =>
      set((state) => {
        state.availableMatches = matches
      }),

    updateMatch: (id, updates) =>
      set((state) => {
        const match = state.availableMatches.find((m) => m.id === id)
        if (match) {
          Object.assign(match, updates)
        }
        if (state.activeMatch?.id === id) {
          Object.assign(state.activeMatch, updates)
        }
      }),

    // UI
    setSidebarTab: (tab) =>
      set((state) => {
        state.sidebarTab = tab
        if (tab === 'chat') {
          state.unreadHintCount = 0
        }
      }),

    // Reset
    reset: () =>
      set((state) => {
        Object.assign(state, initialState)
        state.revealedSpoilerLevels = new Set()
      }),
  }))
)
