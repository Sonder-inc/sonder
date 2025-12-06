export type ChatVariant = 'user' | 'ai' | 'system' | 'error'

export type FeedbackValue = 'bad' | 'good' | 'great' | null

export type ChatMessage = {
  id: string
  variant: ChatVariant
  content: string
  timestamp: Date
  isComplete: boolean
  isStreaming?: boolean
  isInterrupted?: boolean
  feedback?: FeedbackValue
  // Thinking/reasoning content for thinking models
  thinkingContent?: string
  thinkingDurationMs?: number
  isThinking?: boolean
}

export type InputValue = {
  text: string
  cursorPosition: number
  lastEditDueToNav: boolean
}

export type ToolCallStatus = 'executing' | 'complete' | 'error'

export type ToolCall = {
  id: string
  toolName: string
  params: Record<string, unknown>
  status: ToolCallStatus
  summary?: string
  fullResult?: string
  messageId: string // Link to parent AI message
}
