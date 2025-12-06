import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import type { ChatMessage, InputValue, ToolCall, QuestionWizardData } from '../types/chat'
import { saveMessage, loadMessages } from '../services/message-persistence'

export type { InputValue, ToolCall }

export type ChatStoreState = {
  messages: ChatMessage[]
  inputValue: string
  cursorPosition: number
  lastEditDueToNav: boolean
  inputFocused: boolean
  isFocusSupported: boolean
  isStreaming: boolean
  streamingMessageId: string | null
  toolCalls: ToolCall[]
  expandedToolId: string | null
  // Smart shortcut state
  smartShortcut: string | null
  userMessageCount: number
  // Thinking state
  expandedThinkingId: string | null
  // Question wizard state (for interrogator agent)
  questionWizard: QuestionWizardData | null
}

type ChatStoreActions = {
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  loadMessagesForThread: (messageIds: string[]) => void
  clearMessages: () => void
  setInputValue: (value: InputValue | ((prev: InputValue) => InputValue)) => void
  setInputFocused: (focused: boolean) => void
  setIsFocusSupported: (supported: boolean) => void
  setIsStreaming: (streaming: boolean) => void
  setStreamingMessageId: (id: string | null) => void
  appendToStreamingMessage: (content: string) => void
  appendToThinkingContent: (content: string) => void
  addToolCall: (toolCall: ToolCall) => void
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void
  setExpandedToolId: (id: string | null) => void
  toggleExpandedTool: (id: string) => void
  toggleExpandedThinking: (id: string) => void
  // Smart shortcut actions
  setSmartShortcut: (shortcut: string | null) => void
  incrementUserMessageCount: () => number
  // Question wizard actions
  setQuestionWizard: (data: QuestionWizardData | null) => void
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
  toolCalls: [],
  expandedToolId: null,
  smartShortcut: null,
  userMessageCount: 0,
  expandedThinkingId: null,
  questionWizard: null,
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
        // Persist completed messages to disk
        if (message.isComplete) {
          saveMessage(message)
        }
      }),

    updateMessage: (id, updates) =>
      set((state) => {
        const message = state.messages.find((m) => m.id === id)
        if (message) {
          Object.assign(message, updates)
          // Persist when message becomes complete
          if (message.isComplete) {
            saveMessage(message)
          }
        }
      }),

    loadMessagesForThread: (messageIds) =>
      set((state) => {
        state.messages = loadMessages(messageIds)
        state.toolCalls = [] // Clear tool calls when switching threads
        state.expandedToolId = null
      }),

    clearMessages: () =>
      set((state) => {
        state.messages = []
        state.toolCalls = []
        state.expandedToolId = null
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

    appendToThinkingContent: (content) =>
      set((state) => {
        if (state.streamingMessageId) {
          const message = state.messages.find(
            (m) => m.id === state.streamingMessageId,
          )
          if (message) {
            message.thinkingContent = (message.thinkingContent ?? '') + content
          }
        }
      }),

    addToolCall: (toolCall) =>
      set((state) => {
        state.toolCalls.push(toolCall)
      }),

    updateToolCall: (id, updates) =>
      set((state) => {
        const toolCall = state.toolCalls.find((t) => t.id === id)
        if (toolCall) {
          Object.assign(toolCall, updates)
        }
      }),

    setExpandedToolId: (id) =>
      set((state) => {
        state.expandedToolId = id
      }),

    toggleExpandedTool: (id) =>
      set((state) => {
        state.expandedToolId = state.expandedToolId === id ? null : id
      }),

    toggleExpandedThinking: (id) =>
      set((state) => {
        state.expandedThinkingId = state.expandedThinkingId === id ? null : id
      }),

    setSmartShortcut: (shortcut) =>
      set((state) => {
        state.smartShortcut = shortcut
      }),

    incrementUserMessageCount: () => {
      let newCount = 0
      set((state) => {
        state.userMessageCount += 1
        newCount = state.userMessageCount
      })
      return newCount
    },

    setQuestionWizard: (data) =>
      set((state) => {
        state.questionWizard = data
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
        state.toolCalls = []
        state.expandedToolId = null
        state.smartShortcut = null
        state.userMessageCount = 0
        state.expandedThinkingId = null
        state.questionWizard = null
      }),
  })),
)
