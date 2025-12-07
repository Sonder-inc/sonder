/**
 * School Mode Store
 *
 * Manages the state for school mode:
 * - Navigation between categories and machines
 * - Progress tracking (persisted)
 * - Active session state
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import {
  CYBER75,
  CATEGORIES,
  getBoxesByCategory,
  type Cyber75Category,
  type Cyber75Box,
} from '../data/cyber75'

export type SchoolView = 'categories' | 'machines' | 'session'

export interface BoxProgress {
  user: boolean
  root: boolean
  attempts: number
  firstUserAt?: Date
  firstRootAt?: Date
  bestTime?: number // seconds to root
}

interface SchoolStoreState {
  // Navigation
  view: SchoolView
  selectedCategoryIndex: number
  selectedMachineIndex: number
  expandedCategory: Cyber75Category | null

  // Progress (persisted)
  progress: Record<string, BoxProgress>

  // Session
  activeBoxId: string | null
  activeBoxIp: string | null
  sessionStartTime: number | null // timestamp
  vpnConnected: boolean

  // Filtering
  platformFilter: 'all' | 'htb' | 'thm'
  hideCompleted: boolean

  // UI state
  sidebarFocused: boolean
}

interface SchoolStoreActions {
  // Navigation
  setView: (view: SchoolView) => void
  navigateUp: () => void
  navigateDown: () => void
  navigateLeft: () => void
  navigateRight: () => void
  selectCurrent: () => Cyber75Box | null
  expandCategory: (category: Cyber75Category) => void
  collapseCategory: () => void

  // Progress
  setBoxProgress: (boxId: string, progress: Partial<BoxProgress>) => void
  markUserOwned: (boxId: string) => void
  markRootOwned: (boxId: string) => void

  // Session
  startSession: (boxId: string, ip: string) => void
  endSession: () => void
  setVpnConnected: (connected: boolean) => void

  // Filtering
  togglePlatformFilter: () => void
  toggleHideCompleted: () => void

  // UI
  setSidebarFocused: (focused: boolean) => void

  // Helpers
  getVisibleMachines: () => Cyber75Box[]
  getCategoryProgress: (category: Cyber75Category) => { completed: number; total: number }
  getTotalProgress: () => { completed: number; total: number }
  getActiveBox: () => Cyber75Box | null
  getSessionDuration: () => number // seconds

  // Reset
  reset: () => void
}

type SchoolStore = SchoolStoreState & SchoolStoreActions

const initialState: SchoolStoreState = {
  view: 'categories',
  selectedCategoryIndex: 0,
  selectedMachineIndex: 0,
  expandedCategory: null,
  progress: {},
  activeBoxId: null,
  activeBoxIp: null,
  sessionStartTime: null,
  vpnConnected: false,
  platformFilter: 'all',
  hideCompleted: false,
  sidebarFocused: true,
}

export const useSchoolStore = create<SchoolStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // ─── Navigation ───────────────────────────────────────────────────────────

      setView: (view) =>
        set((state) => {
          state.view = view
        }),

      navigateUp: () =>
        set((state) => {
          if (state.view === 'categories') {
            state.selectedCategoryIndex = Math.max(0, state.selectedCategoryIndex - 1)
          } else if (state.view === 'machines') {
            state.selectedMachineIndex = Math.max(0, state.selectedMachineIndex - 1)
          }
        }),

      navigateDown: () =>
        set((state) => {
          if (state.view === 'categories') {
            const maxIndex = CATEGORIES.length - 1
            state.selectedCategoryIndex = Math.min(maxIndex, state.selectedCategoryIndex + 1)
          } else if (state.view === 'machines') {
            const machines = get().getVisibleMachines()
            const maxIndex = machines.length - 1
            state.selectedMachineIndex = Math.min(maxIndex, state.selectedMachineIndex + 1)
          }
        }),

      navigateLeft: () =>
        set((state) => {
          if (state.view === 'machines') {
            state.view = 'categories'
            state.expandedCategory = null
            state.selectedMachineIndex = 0
          }
        }),

      navigateRight: () => {
        const state = get()
        if (state.view === 'categories') {
          const category = CATEGORIES[state.selectedCategoryIndex]
          if (category) {
            set((s) => {
              s.view = 'machines'
              s.expandedCategory = category.id
              s.selectedMachineIndex = 0
            })
          }
        }
      },

      selectCurrent: () => {
        const state = get()
        if (state.view === 'machines') {
          const machines = state.getVisibleMachines()
          return machines[state.selectedMachineIndex] || null
        }
        return null
      },

      expandCategory: (category) =>
        set((state) => {
          state.view = 'machines'
          state.expandedCategory = category
          state.selectedMachineIndex = 0
        }),

      collapseCategory: () =>
        set((state) => {
          state.view = 'categories'
          state.expandedCategory = null
          state.selectedMachineIndex = 0
        }),

      // ─── Progress ─────────────────────────────────────────────────────────────

      setBoxProgress: (boxId, progress) =>
        set((state) => {
          if (!state.progress[boxId]) {
            state.progress[boxId] = { user: false, root: false, attempts: 0 }
          }
          Object.assign(state.progress[boxId], progress)
        }),

      markUserOwned: (boxId) =>
        set((state) => {
          if (!state.progress[boxId]) {
            state.progress[boxId] = { user: false, root: false, attempts: 0 }
          }
          if (!state.progress[boxId].user) {
            state.progress[boxId].user = true
            state.progress[boxId].firstUserAt = new Date()
          }
        }),

      markRootOwned: (boxId) =>
        set((state) => {
          if (!state.progress[boxId]) {
            state.progress[boxId] = { user: false, root: false, attempts: 0 }
          }
          if (!state.progress[boxId].root) {
            state.progress[boxId].root = true
            state.progress[boxId].firstRootAt = new Date()
            // Record time if we have a session
            if (state.sessionStartTime) {
              const duration = Math.floor((Date.now() - state.sessionStartTime) / 1000)
              const current = state.progress[boxId].bestTime
              if (!current || duration < current) {
                state.progress[boxId].bestTime = duration
              }
            }
          }
        }),

      // ─── Session ──────────────────────────────────────────────────────────────

      startSession: (boxId, ip) =>
        set((state) => {
          state.activeBoxId = boxId
          state.activeBoxIp = ip
          state.sessionStartTime = Date.now()
          state.view = 'session'

          // Increment attempts
          if (!state.progress[boxId]) {
            state.progress[boxId] = { user: false, root: false, attempts: 0 }
          }
          state.progress[boxId].attempts += 1
        }),

      endSession: () =>
        set((state) => {
          state.activeBoxId = null
          state.activeBoxIp = null
          state.sessionStartTime = null
          state.view = 'categories'
        }),

      setVpnConnected: (connected) =>
        set((state) => {
          state.vpnConnected = connected
        }),

      // ─── Filtering ────────────────────────────────────────────────────────────

      togglePlatformFilter: () =>
        set((state) => {
          const filters: Array<'all' | 'htb' | 'thm'> = ['all', 'htb', 'thm']
          const currentIndex = filters.indexOf(state.platformFilter)
          state.platformFilter = filters[(currentIndex + 1) % filters.length]
        }),

      toggleHideCompleted: () =>
        set((state) => {
          state.hideCompleted = !state.hideCompleted
        }),

      // ─── UI ───────────────────────────────────────────────────────────────────

      setSidebarFocused: (focused) =>
        set((state) => {
          state.sidebarFocused = focused
        }),

      // ─── Helpers ──────────────────────────────────────────────────────────────

      getVisibleMachines: () => {
        const state = get()
        if (!state.expandedCategory) return []

        let machines = getBoxesByCategory(state.expandedCategory)

        // Apply platform filter
        if (state.platformFilter !== 'all') {
          machines = machines.filter((m) => m.platform === state.platformFilter)
        }

        // Apply hide completed filter
        if (state.hideCompleted) {
          machines = machines.filter((m) => {
            const progress = state.progress[m.id]
            return !(progress?.user && progress?.root)
          })
        }

        return machines
      },

      getCategoryProgress: (category) => {
        const state = get()
        const boxes = getBoxesByCategory(category)
        const completed = boxes.filter((box) => {
          const p = state.progress[box.id]
          return p?.user && p?.root
        }).length
        return { completed, total: boxes.length }
      },

      getTotalProgress: () => {
        const state = get()
        const completed = CYBER75.filter((box) => {
          const p = state.progress[box.id]
          return p?.user && p?.root
        }).length
        return { completed, total: CYBER75.length }
      },

      getActiveBox: () => {
        const state = get()
        if (!state.activeBoxId) return null
        return CYBER75.find((box) => box.id === state.activeBoxId) || null
      },

      getSessionDuration: () => {
        const state = get()
        if (!state.sessionStartTime) return 0
        return Math.floor((Date.now() - state.sessionStartTime) / 1000)
      },

      // ─── Reset ────────────────────────────────────────────────────────────────

      reset: () =>
        set((state) => {
          // Keep progress, reset navigation
          state.view = 'categories'
          state.selectedCategoryIndex = 0
          state.selectedMachineIndex = 0
          state.expandedCategory = null
          state.activeBoxId = null
          state.activeBoxIp = null
          state.sessionStartTime = null
          state.sidebarFocused = true
        }),
    })),
    {
      name: 'sonder-school-progress',
      // Only persist progress
      partialize: (state) => ({
        progress: state.progress,
      }),
    }
  )
)
