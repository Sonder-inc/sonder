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
  // UI display customization
  displayName?: string // Override tool name in UI
  displayInput?: string // Clean input display
  displayMiddle?: string // Content between tool line and summary
  displayColor?: 'default' | 'success' | 'error' // Indicator color
  status: ToolCallStatus
  summary?: string
  fullResult?: string
  messageId: string // Link to parent AI message
}

/**
 * Question option for wizard UI
 */
export type QuestionOption = {
  label: string
  description?: string
}

/**
 * Single question in the wizard
 */
export type WizardQuestion = {
  id: string
  header: string // Short label like "Scope"
  question: string
  options: QuestionOption[]
  allowCustom?: boolean
}

/**
 * Question wizard data for interrogator UI
 */
export type QuestionWizardData = {
  questions: WizardQuestion[]
  onComplete: (answers: Record<string, string>) => void
  onCancel: () => void
}
