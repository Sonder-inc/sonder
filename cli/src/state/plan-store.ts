import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type PlanItemStatus = 'pending' | 'in_progress' | 'completed'

export interface PlanItem {
  id: string
  content: string
  status: PlanItemStatus
}

export interface PlanStoreState {
  items: PlanItem[]
}

interface PlanStoreActions {
  setItems: (items: PlanItem[]) => void
  clear: () => void
}

type PlanStore = PlanStoreState & PlanStoreActions

const initialState: PlanStoreState = {
  items: [],
}

export const usePlanStore = create<PlanStore>()(
  immer((set) => ({
    ...initialState,

    setItems: (items) =>
      set((state) => {
        state.items = items
      }),

    clear: () =>
      set((state) => {
        state.items = []
      }),
  })),
)
