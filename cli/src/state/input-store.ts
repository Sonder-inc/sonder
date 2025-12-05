import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { InputValue } from '../types/chat'

export type InputStoreState = {
  inputValue: string
  cursorPosition: number
  lastEditDueToNav: boolean
  inputFocused: boolean
  isFocusSupported: boolean
}

type InputStoreActions = {
  setInputValue: (value: InputValue | ((prev: InputValue) => InputValue)) => void
  setInputFocused: (focused: boolean) => void
  setIsFocusSupported: (supported: boolean) => void
  reset: () => void
}

type InputStore = InputStoreState & InputStoreActions

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const initialState: InputStoreState = {
  inputValue: '',
  cursorPosition: 0,
  lastEditDueToNav: false,
  inputFocused: true,
  isFocusSupported: false,
}

export const useInputStore = create<InputStore>()(
  immer((set) => ({
    ...initialState,

    setInputValue: (value) =>
      set((state) => {
        const { text, cursorPosition, lastEditDueToNav } =
          typeof value === 'function'
            ? value({
                text: state.inputValue,
                cursorPosition: state.cursorPosition,
                lastEditDueToNav: state.lastEditDueToNav,
              })
            : value
        state.inputValue = text
        state.cursorPosition = clamp(cursorPosition, 0, text.length)
        state.lastEditDueToNav = lastEditDueToNav
      }),

    setInputFocused: (focused) =>
      set((state) => {
        state.inputFocused = focused
      }),

    setIsFocusSupported: (supported) =>
      set((state) => {
        state.isFocusSupported = supported
      }),

    reset: () =>
      set((state) => {
        state.inputValue = ''
        state.cursorPosition = 0
        state.lastEditDueToNav = false
        state.inputFocused = true
      }),
  })),
)
