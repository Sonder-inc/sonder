import { useCallback, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useKeyboard } from '@opentui/react'

import { useTheme } from './hooks/use-theme'
import { useTerminalDimensions } from './hooks/use-terminal-dimensions'
import { useChatStore } from './state/chat-store'
import { InputBox } from './components/input-box'
import { WelcomeBanner } from './components/welcome-banner'
import type { MultilineInputHandle } from './components/multiline-input'

import type { KeyEvent, ScrollBoxRenderable } from '@opentui/core'

interface AppProps {
  initialPrompt: string | null
}

export const App = ({ initialPrompt }: AppProps) => {
  const theme = useTheme()
  const { terminalWidth, terminalHeight } = useTerminalDimensions()
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const inputRef = useRef<MultilineInputHandle | null>(null)

  const {
    messages,
    addMessage,
    updateMessage,
    inputValue,
    cursorPosition,
    setInputValue,
    inputFocused,
    isStreaming,
    setIsStreaming,
    setStreamingMessageId,
  } = useChatStore(
    useShallow((store) => ({
      messages: store.messages,
      addMessage: store.addMessage,
      updateMessage: store.updateMessage,
      inputValue: store.inputValue,
      cursorPosition: store.cursorPosition,
      setInputValue: store.setInputValue,
      inputFocused: store.inputFocused,
      isStreaming: store.isStreaming,
      setIsStreaming: store.setIsStreaming,
      setStreamingMessageId: store.setStreamingMessageId,
    })),
  )

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMessageId = generateId()
      addMessage({
        id: userMessageId,
        variant: 'user',
        content,
        timestamp: new Date(),
        isComplete: true,
      })

      const aiMessageId = generateId()
      addMessage({
        id: aiMessageId,
        variant: 'ai',
        content: '',
        timestamp: new Date(),
        isComplete: false,
        isStreaming: true,
      })

      setIsStreaming(true)
      setStreamingMessageId(aiMessageId)

      try {
        const response = `Received: "${content}"\n\nThis is a placeholder. Connect to your AI backend!`
        for (let i = 0; i < response.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 15))
          updateMessage(aiMessageId, { content: response.slice(0, i + 1) })
        }
        updateMessage(aiMessageId, { isComplete: true, isStreaming: false })
      } catch (error) {
        updateMessage(aiMessageId, {
          content: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
          variant: 'error',
          isComplete: true,
          isStreaming: false,
        })
      } finally {
        setIsStreaming(false)
        setStreamingMessageId(null)
      }
    },
    [addMessage, updateMessage, setIsStreaming, setStreamingMessageId],
  )

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || isStreaming) return
    handleSendMessage(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  }, [inputValue, isStreaming, handleSendMessage, setInputValue])

  // Ctrl+C handler
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

  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      handleSendMessage(initialPrompt)
    }
  }, [])

  // Layout calculations
  const sidebarWidth = Math.max(20, Math.floor(terminalWidth * 0.25))
  const mainWidth = terminalWidth - sidebarWidth - 3

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 0 }}>
      {/* Messages scrollbox - banner is inside and scrolls with messages */}
      <scrollbox
        ref={scrollRef}
        stickyScroll
        stickyStart="bottom"
        scrollX={false}
        scrollbarOptions={{ visible: false }}
        style={{
          flexGrow: 1,
          rootOptions: {
            flexGrow: 1,
            padding: 0,
            gap: 0,
            flexDirection: 'row',
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
            justifyContent: 'flex-end',
            backgroundColor: 'transparent',
            paddingLeft: 1,
            paddingRight: 1,
          },
        }}
      >
        {/* Banner - scrolls with chat */}
        <WelcomeBanner />

        {/* Messages */}
        {messages.map((msg) => (
          <box key={msg.id} style={{ marginBottom: 1 }}>
            <text style={{ fg: msg.variant === 'user' ? theme.accent : theme.foreground, wrapMode: 'word' }}>
              {msg.variant === 'user' ? '> ' : ''}
              {msg.content}
              {msg.isStreaming ? '▌' : ''}
            </text>
          </box>
        ))}
      </scrollbox>

      {/* Bottom row: Input box + Sidebar */}
      <box style={{ flexDirection: 'row', flexShrink: 0, marginLeft: 1, marginRight: 1, marginBottom: 1 }}>
        {/* Input box */}
        <InputBox
          ref={inputRef}
          inputValue={inputValue}
          cursorPosition={cursorPosition}
          setInputValue={setInputValue}
          onSubmit={handleSubmit}
          focused={inputFocused && !isStreaming}
          width={mainWidth}
          model="Sonder"
          mode="stealth"
        />

        {/* Sidebar */}
        <box
          style={{
            width: sidebarWidth,
            borderStyle: 'single',
            borderColor: theme.borderMuted,
            marginLeft: 1,
            padding: 1,
          }}
        >
          <text style={{ fg: theme.warning }}>
            {'-->|'} <span fg={theme.muted}>/init to start</span>
          </text>
          <text style={{ fg: theme.muted, marginTop: 1 }}>Plan</text>
        </box>
      </box>
    </box>
  )
}
