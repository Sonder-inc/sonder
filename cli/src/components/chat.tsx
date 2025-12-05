import { useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useKeyboard } from '@opentui/react'


import { MessageBlock } from './message-block'
import { WelcomeBanner } from './welcome-banner'
import { useTheme } from '../hooks/use-theme'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useChatStore } from '../state/chat-store'

import type { MultilineInputHandle } from './multiline-input'
import type { KeyEvent, ScrollBoxRenderable } from '@opentui/core'

interface ChatProps {
  onSendMessage: (content: string) => void
}

export const Chat = ({ onSendMessage }: ChatProps) => {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const inputRef = useRef<MultilineInputHandle | null>(null)

  const { separatorWidth, terminalWidth, terminalHeight } = useTerminalDimensions()
  const theme = useTheme()

  const {
    inputValue,
    cursorPosition,
    setInputValue,
    inputFocused,
    setInputFocused,
    messages,
    isStreaming,
  } = useChatStore(
    useShallow((store) => ({
      inputValue: store.inputValue,
      cursorPosition: store.cursorPosition,
      setInputValue: store.setInputValue,
      inputFocused: store.inputFocused,
      setInputFocused: store.setInputFocused,
      messages: store.messages,
      isStreaming: store.isStreaming,
    })),
  )

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    onSendMessage(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  }, [inputValue, onSendMessage, setInputValue])

  // Handle Ctrl+C to exit
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (key.ctrl && key.name === 'c') {
          if (inputValue.length === 0) {
            process.exit(0)
          } else {
            setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          }
        }
      },
      [inputValue, setInputValue],
    ),
  )

  const inputWidth = separatorWidth - 4

  return (
    <box
      style={{
        flexDirection: 'column',
        gap: 0,
        flexGrow: 1,
      }}
    >
      {/* Main scrollable content */}
      <scrollbox
        ref={scrollRef}
        stickyScroll
        stickyStart="bottom"
        scrollX={false}
        scrollbarOptions={{ visible: false }}
        verticalScrollbarOptions={{
          visible: messages.length > 5,
          trackOptions: { width: 1 },
        }}
        style={{
          flexGrow: 1,
          rootOptions: {
            flexGrow: 1,
            padding: 0,
            gap: 0,
            flexDirection: 'column',
            shouldFill: true,
            backgroundColor: 'transparent',
          },
          wrapperOptions: {
            flexGrow: 1,
            border: false,
            shouldFill: true,
            backgroundColor: 'transparent',
            flexDirection: 'column',
          },
          contentOptions: {
            flexDirection: 'column',
            gap: 0,
            shouldFill: true,
            justifyContent: 'flex-start',
            backgroundColor: 'transparent',
          },
        }}
      >
        {/* Welcome banner at top */}
        <WelcomeBanner width={inputWidth} />

        {/* Messages area */}
        <box
          style={{
            flexDirection: 'column',
            paddingLeft: 2,
            paddingRight: 2,
            marginTop: 1,
            flexGrow: 1,
          }}
        >
          {messages.map((message) => (
            <MessageBlock
              key={message.id}
              message={message}
              availableWidth={separatorWidth}
            />
          ))}
        </box>
      </scrollbox>

      {/* Bottom input area */}
      <box
        style={{
          flexShrink: 0,
          backgroundColor: 'transparent',
        }}
      >
        

        {/* Status bar */}
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingLeft: 2,
            paddingRight: 2,
            height: 1,
            marginBottom: 1,
          }}
        >
          <text style={{ fg: theme.muted }}>? for shortcuts</text>
          <text style={{ fg: theme.muted }}>
            {isStreaming ? 'Thinking...' : 'Ready'}
          </text>
        </box>
      </box>
    </box>
  )
}
