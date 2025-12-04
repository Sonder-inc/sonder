export type ChatVariant = 'user' | 'ai' | 'system' | 'error'

export type ChatMessage = {
  id: string
  variant: ChatVariant
  content: string
  timestamp: Date
  isComplete: boolean
  isStreaming?: boolean
}

export type InputValue = {
  text: string
  cursorPosition: number
  lastEditDueToNav: boolean
}
