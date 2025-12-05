import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useTerminalDimensions } from './hooks/use-terminal-dimensions'
import { useChatHandler } from './hooks/use-chat-handler'
import { useAppKeyboard } from './hooks/use-app-keyboard'
import { useChatStore } from './state/chat-store'
import { InputBox } from './components/input-box'
import { WelcomeBanner } from './components/welcome-banner'
import { StreamingStatus } from './components/streaming-status'
import { MessageList } from './components/chat/MessageList'
import { ShortcutsPanel } from './components/panels/ShortcutsPanel'
import { CommandPanel } from './components/panels/CommandPanel'
import { ContextPanel } from './components/panels/ContextPanel'
import { Sidebar } from './components/Sidebar'
import { MODELS, MODES, MODEL_IDS } from './constants/app-constants'

import type { MultilineInputHandle } from './components/multiline-input'
import type { ScrollBoxRenderable } from '@opentui/core'

interface AppProps {
  initialPrompt: string | null
}

export const App = ({ initialPrompt }: AppProps) => {
  const { terminalWidth } = useTerminalDimensions()
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const inputRef = useRef<MultilineInputHandle | null>(null)
  const [modelIndex, setModelIndex] = useState(0)
  const [modeIndex, setModeIndex] = useState(0)

  const {
    messages,
    addMessage,
    updateMessage,
    appendToStreamingMessage,
    inputValue,
    cursorPosition,
    setInputValue,
    inputFocused,
    isStreaming,
    setIsStreaming,
    setStreamingMessageId,
    toolCalls,
    addToolCall,
    updateToolCall,
    expandedToolId,
    toggleExpandedTool,
    smartShortcut,
    setSmartShortcut,
    incrementUserMessageCount,
  } = useChatStore(
    useShallow((store) => ({
      messages: store.messages,
      addMessage: store.addMessage,
      updateMessage: store.updateMessage,
      appendToStreamingMessage: store.appendToStreamingMessage,
      inputValue: store.inputValue,
      cursorPosition: store.cursorPosition,
      setInputValue: store.setInputValue,
      inputFocused: store.inputFocused,
      isStreaming: store.isStreaming,
      setIsStreaming: store.setIsStreaming,
      setStreamingMessageId: store.setStreamingMessageId,
      toolCalls: store.toolCalls,
      addToolCall: store.addToolCall,
      updateToolCall: store.updateToolCall,
      expandedToolId: store.expandedToolId,
      toggleExpandedTool: store.toggleExpandedTool,
      smartShortcut: store.smartShortcut,
      setSmartShortcut: store.setSmartShortcut,
      incrementUserMessageCount: store.incrementUserMessageCount,
    })),
  )

  // Chat handling logic
  const {
    handleSendMessage,
    flavorWord,
    showStatus,
    streamStartTime,
    tokenCount,
    cancelStream,
  } = useChatHandler({
    model: MODEL_IDS[MODELS[modelIndex]],
    messages,
    addMessage,
    updateMessage,
    appendToStreamingMessage,
    setIsStreaming,
    setStreamingMessageId,
    addToolCall,
    updateToolCall,
    incrementUserMessageCount,
    setSmartShortcut,
  })

  // Keyboard handling logic
  const {
    handleKeyIntercept,
    showShortcuts,
    showCommands,
    showContext,
    selectedMenuIndex,
    pendingExit,
  } = useAppKeyboard({
    inputValue,
    setInputValue,
    handleSendMessage,
    isStreaming,
    cancelStream,
    toolCalls,
    toggleExpandedTool,
    modelIndex,
    setModelIndex,
    modeIndex,
    setModeIndex,
    smartShortcut,
    setSmartShortcut,
  })

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || isStreaming) return
    handleSendMessage(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  }, [inputValue, isStreaming, handleSendMessage, setInputValue])

  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      handleSendMessage(initialPrompt)
    }
  }, [])

  // Layout calculations
  const sidebarWidth = Math.max(20, Math.floor(terminalWidth * 0.25))
  const mainWidth = terminalWidth - sidebarWidth - 3

  return (
    <box style={{ flexDirection: 'row', flexGrow: 1, gap: 0 }}>
      {/* Main content column (scrollbox + input) */}
      <box style={{ flexDirection: 'column', flexGrow: 1, width: mainWidth + 2 }}>
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
          <WelcomeBanner width={mainWidth} />

          {/* Messages */}
          <MessageList
            messages={messages}
            toolCalls={toolCalls}
            expandedToolId={expandedToolId}
            onToggleExpandTool={toggleExpandedTool}
          />
        </scrollbox>

        {/* Streaming status - always reserves space, content shown when ready */}
        <box style={{ marginLeft: 2, height: isStreaming ? 2 : 0 }}>
          {isStreaming && showStatus && flavorWord && (
            <StreamingStatus
              flavorWord={flavorWord}
              startTime={streamStartTime}
              tokenCount={tokenCount}
            />
          )}
        </box>

        {/* Input box */}
        <box style={{ flexDirection: 'column', flexShrink: 0, marginLeft: 1, marginRight: 1, marginBottom: 1 }}>
          <InputBox
            ref={inputRef}
            inputValue={inputValue}
            cursorPosition={cursorPosition}
            setInputValue={setInputValue}
            onSubmit={handleSubmit}
            focused={inputFocused && !isStreaming}
            width={mainWidth}
            model={MODELS[modelIndex]}
            mode={MODES[modeIndex]}
            onKeyIntercept={handleKeyIntercept}
            hintOverride={pendingExit ? 'exit? [^C]' : undefined}
          />

          {/* Panels - shown below input */}
          {showShortcuts && <ShortcutsPanel />}
          {showCommands && <CommandPanel inputValue={inputValue} selectedIndex={selectedMenuIndex} />}
          {showContext && <ContextPanel inputValue={inputValue} selectedIndex={selectedMenuIndex} />}
        </box>
      </box>

      {/* Sidebar - full height */}
      <Sidebar width={sidebarWidth} smartShortcut={smartShortcut} />
    </box>
  )
}
