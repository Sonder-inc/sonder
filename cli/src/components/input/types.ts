import type { KeyEvent } from '@opentui/core'
import type { InputValue } from '../../types/chat'
import type { ChatTheme } from '../../types/theme'

export interface MultilineInputProps {
  value: string
  onChange: (value: InputValue) => void
  onSubmit: () => void
  onKeyIntercept?: (key: KeyEvent) => boolean
  placeholder?: string
  focused?: boolean
  shouldBlinkCursor?: boolean
  hideCursor?: boolean
  maxHeight?: number
  minHeight?: number
  width: number
  textAttributes?: number
  cursorPosition: number
}

export interface MultilineInputHandle {
  focus: () => void
}

export interface CursorRendererProps {
  displayValue: string
  displayValueForRendering: string
  cursorPosition: number
  renderCursorPosition: number
  isPlaceholder: boolean
  cursorVisible: boolean
  showCursor: boolean
  slashCommandEnd: number
  theme: ChatTheme
}

export interface InputBoxProps {
  inputValue: string
  cursorPosition: number
  setInputValue: (value: InputValue | ((prev: InputValue) => InputValue)) => void
  onSubmit: () => void
  focused: boolean
  width: number
  model?: string
  mode?: string
  onKeyIntercept?: (key: KeyEvent) => boolean
  hintOverride?: string
  accentColor?: string
}
