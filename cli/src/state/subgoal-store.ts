import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type SubgoalStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

export interface Subgoal {
  id: string
  objective: string
  status: SubgoalStatus
  plan?: string
  logs: string[]
}

export interface SubgoalStoreState {
  subgoals: Record<string, Subgoal>
}

interface SubgoalStoreActions {
  addSubgoal: (subgoal: Subgoal) => void
  updateSubgoal: (id: string, updates: Partial<Omit<Subgoal, 'id'>>) => void
  appendLog: (id: string, log: string) => void
  clear: () => void
}

type SubgoalStore = SubgoalStoreState & SubgoalStoreActions

const initialState: SubgoalStoreState = {
  subgoals: {},
}

export const useSubgoalStore = create<SubgoalStore>()(
  immer((set) => ({
    ...initialState,

    addSubgoal: (subgoal) =>
      set((state) => {
        state.subgoals[subgoal.id] = subgoal
      }),

    updateSubgoal: (id, updates) =>
      set((state) => {
        if (state.subgoals[id]) {
          Object.assign(state.subgoals[id], updates)
        }
      }),

    appendLog: (id, log) =>
      set((state) => {
        if (state.subgoals[id]) {
          state.subgoals[id].logs.push(log)
        }
      }),

    clear: () =>
      set((state) => {
        state.subgoals = {}
      }),
  })),
)
