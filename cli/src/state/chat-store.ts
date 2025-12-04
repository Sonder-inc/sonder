import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { ChatMessage, InputValue } from '../types/chat'

export type { InputValue }

export type ChatStoreState = {
  messages: ChatMessage[]
  inputValue: string
  cursorPosition: number
  lastEditDueToNav: boolean
  inputFocused: boolean
  isFocusSupported: boolean
  isStreaming: boolean
  streamingMessageId: string | null
}

type ChatStoreActions = {
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  setInputValue: (value: InputValue | ((prev: InputValue) => InputValue)) => void
  setInputFocused: (focused: boolean) => void
  setIsFocusSupported: (supported: boolean) => void
  setIsStreaming: (streaming: boolean) => void
  setStreamingMessageId: (id: string | null) => void
  appendToStreamingMessage: (content: string) => void
  reset: () => void
}

type ChatStore = ChatStoreState & ChatStoreActions

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const initialState: ChatStoreState = {
  messages: [],
  inputValue: '',
  cursorPosition: 0,
  lastEditDueToNav: false,
  inputFocused: true,
  isFocusSupported: false,
  isStreaming: false,
  streamingMessageId: null,
}

export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    ...initialState,

    setMessages: (value) =>
      set((state) => {
        state.messages =
          typeof value === 'function' ? value(state.messages) : value
      }),

    addMessage: (message) =>
      set((state) => {
        state.messages.push(message)
      }),

    updateMessage: (id, updates) =>
      set((state) => {
        const message = state.messages.find((m) => m.id === id)
        if (message) {
          Object.assign(message, updates)
        }
      }),

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

    setIsStreaming: (streaming) =>
      set((state) => {
        state.isStreaming = streaming
      }),

    setStreamingMessageId: (id) =>
      set((state) => {
        state.streamingMessageId = id
      }),

    appendToStreamingMessage: (content) =>
      set((state) => {
        if (state.streamingMessageId) {
          const message = state.messages.find(
            (m) => m.id === state.streamingMessageId,
          )
          if (message) {
            message.content += content
          }
        }
      }),

    reset: () =>
      set((state) => {
        state.messages = []
        state.inputValue = ''
        state.cursorPosition = 0
        state.lastEditDueToNav = false
        state.inputFocused = true
        state.isStreaming = false
        state.streamingMessageId = null
      }),
  })),
)
