import { forwardRef } from 'react'

import { MultilineInput, type MultilineInputHandle } from './multiline-input'
import { useTheme } from '../hooks/use-theme'
import type { InputValue } from '../state/chat-store'

interface ChatInputBarProps {
  inputValue: string
  cursorPosition: number
  setInputValue: (value: InputValue | ((prev: InputValue) => InputValue)) => void
  inputFocused: boolean
  inputWidth: number
  onSubmit: () => void
  placeholder?: string
  isStreaming?: boolean
}

export const ChatInputBar = forwardRef<MultilineInputHandle, ChatInputBarProps>(
  function ChatInputBar(
    {
      inputValue,
      cursorPosition,
      setInputValue,
      inputFocused,
      inputWidth,
      onSubmit,
      placeholder = 'Try "scan target <ip>"',
      isStreaming = false,
    },
    ref,
  ) {
    const theme = useTheme()

    return (
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          borderStyle: 'rounded',
          borderColor: inputFocused ? theme.accent : theme.borderColor,
          marginLeft: 1,
          marginRight: 1,
          marginTop: 1,
          marginBottom: 0,
        }}
      >
        {/* Prompt indicator */}
        <text
          style={{
            fg: theme.accent,
            paddingLeft: 1,
            paddingTop: 0,
          }}
        >
          {'>'}
        </text>

        {/* Input field */}
        <box style={{ flexGrow: 1 }}>
          <MultilineInput
            ref={ref}
            value={inputValue}
            cursorPosition={cursorPosition}
            onChange={setInputValue}
            onSubmit={onSubmit}
            placeholder={placeholder}
            focused={inputFocused && !isStreaming}
            width={inputWidth - 3}
            maxHeight={10}
            minHeight={1}
          />
        </box>
      </box>
    )
  },
)
