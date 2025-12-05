import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useKeyboard } from '@opentui/react'

import { useTheme } from './hooks/use-theme'
import { useTerminalDimensions } from './hooks/use-terminal-dimensions'
import { useChatStore } from './state/chat-store'
import { InputBox } from './components/input-box'
import { WelcomeBanner } from './components/welcome-banner'
import { ShimmerText } from './components/shimmer-text'
import { streamChat, type Message } from './services/openrouter'
import type { MultilineInputHandle } from './components/multiline-input'

import type { KeyEvent, ScrollBoxRenderable } from '@opentui/core'
import { yellow, fg, t } from '@opentui/core'

interface AppProps {
  initialPrompt: string | null
}

const MODELS = ['Sonder', 'Opus 4.5', 'GPT5', 'G3 Pro'] as const
const MODEL_IDS: Record<(typeof MODELS)[number], string> = {
  Sonder: 'anthropic/claude-3.7-sonnet:thinking',
  'Opus 4.5': 'anthropic/claude-opus-4.5',
  GPT5: 'openai/gpt-5.1',
  'G3 Pro': 'google/gemini-3-pro-preview',
}
const MODES = ['stealth', 'osint', 'semi-auto', 'kill'] as const

// Command definitions for the command menu
const COMMANDS = [
  { name: '/add-dir', aliases: [], description: 'Add a new working directory' },
  { name: '/agents', aliases: [], description: 'Manage agent configurations' },
  { name: '/clear', aliases: ['reset', 'new'], description: 'Clear conversation history and free up context' },
  { name: '/config', aliases: ['theme'], description: 'Open config panel' },
  { name: '/context', aliases: [], description: 'Visualize current context usage as a colored grid' },
  { name: '/doctor', aliases: [], description: 'Diagnose and verify your installation and settings' },
  { name: '/exit', aliases: ['quit'], description: 'Exit the REPL' },
  { name: '/login', aliases: ['logout'], description: 'Login or logout when already logged in' },
] as const

// Trie node for command prefix matching
class TrieNode {
  children: Map<string, TrieNode> = new Map()
  commands: typeof COMMANDS[number][] = []
}

// Build trie from commands
function buildCommandTrie(commands: typeof COMMANDS): TrieNode {
  const root = new TrieNode()

  for (const cmd of commands) {
    let node = root
    // Insert the command name (including the /)
    for (const char of cmd.name.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode())
      }
      node = node.children.get(char)!
      node.commands.push(cmd)
    }
  }

  return root
}

const commandTrie = buildCommandTrie(COMMANDS)

// Search trie for commands matching a prefix
function searchCommands(prefix: string): typeof COMMANDS[number][] {
  let node = commandTrie
  const lowerPrefix = prefix.toLowerCase()

  for (const char of lowerPrefix) {
    if (!node.children.has(char)) {
      return []
    }
    node = node.children.get(char)!
  }

  return node.commands
}

export const App = ({ initialPrompt }: AppProps) => {
  const theme = useTheme()
  const { terminalWidth, terminalHeight } = useTerminalDimensions()
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const inputRef = useRef<MultilineInputHandle | null>(null)
  const [modelIndex, setModelIndex] = useState(0)
  const [modeIndex, setModeIndex] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)

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
        // Build message history for context (only completed messages)
        const chatMessages: Message[] = [
          ...messages
            .filter((msg) => msg.isComplete && msg.variant !== 'error')
            .map((msg) => ({
              role: (msg.variant === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: msg.content,
            })),
          { role: 'user' as const, content },
        ]

        await streamChat(
          chatMessages,
          (chunk) => appendToStreamingMessage(chunk),
          MODEL_IDS[MODELS[modelIndex]],
        )
        updateMessage(aiMessageId, { isComplete: true, isStreaming: false })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        updateMessage(aiMessageId, {
          content: `Error: ${errorMsg}`,
          variant: 'error',
          isComplete: true,
          isStreaming: false,
        })
      } finally {
        setIsStreaming(false)
        setStreamingMessageId(null)
      }
    },
    [messages, addMessage, updateMessage, appendToStreamingMessage, setIsStreaming, setStreamingMessageId, modelIndex],
  )

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || isStreaming) return
    handleSendMessage(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  }, [inputValue, isStreaming, handleSendMessage, setInputValue])

  // Key intercept for input - handles Shift+M before input processes it
  const handleKeyIntercept = useCallback(
    (key: KeyEvent): boolean => {
      // Shift+M: cycle through modes
      if (key.shift && key.name === 'm') {
        setModeIndex((prev) => (prev + 1) % MODES.length)
        return true // handled, don't process further
      }
      // Shift+Tab: cycle through models
      if (key.shift && key.name === 'tab') {
        setModelIndex((prev) => (prev + 1) % MODELS.length)
        return true
      }
      // ?: toggle shortcuts panel (only if not showing commands)
      if (key.sequence === '?') {
        if (showCommands) {
          // do nothing if commands panel is open
          return true
        }
        setShowContext(false)
        setShowShortcuts((prev) => !prev)
        return true
      }
      // Shift+* (asterisk): toggle context panel
      if (key.sequence === '*') {
        if (showCommands) {
          // do nothing if commands panel is open
          return true
        }
        setShowShortcuts(false)
        setShowContext((prev) => !prev)
        return true
      }
      // /: show commands panel, exit shortcuts/context if open
      if (key.sequence === '/' && inputValue.length === 0) {
        setShowShortcuts(false)
        setShowContext(false)
        setShowCommands(true)
        setSelectedCommandIndex(0)
        return false // let it type the /
      }
      // Arrow keys: navigate command menu
      if (showCommands && (key.name === 'up' || key.name === 'down')) {
        const filtered = searchCommands(inputValue)
        if (filtered.length > 0) {
          if (key.name === 'up') {
            setSelectedCommandIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
          } else {
            setSelectedCommandIndex((prev) => (prev + 1) % filtered.length)
          }
        }
        return true // consume the key
      }
      // Tab or Enter: autocomplete selected command
      if (showCommands && (key.name === 'tab' || key.name === 'return' || key.name === 'enter')) {
        const filtered = searchCommands(inputValue)
        if (filtered.length > 0) {
          const selected = filtered[selectedCommandIndex] ?? filtered[0]
          setInputValue({ text: selected.name + ' ', cursorPosition: selected.name.length + 1, lastEditDueToNav: false })
          setShowCommands(false)
          setSelectedCommandIndex(0)
        }
        return true // consume the key
      }
      // Space: close commands panel (command is complete)
      if (key.sequence === ' ' && showCommands) {
        setShowCommands(false)
        return false // let it type the space
      }
      // Backspace: close commands panel if input will no longer start with /
      if (key.name === 'backspace' && showCommands) {
        if (inputValue === '/' || !inputValue.startsWith('/')) {
          setShowCommands(false)
        }
        return false // let it delete the character
      }
      // Escape: close panels
      if (key.name === 'escape' && (showShortcuts || showCommands || showContext)) {
        setShowShortcuts(false)
        setShowCommands(false)
        setShowContext(false)
        return true
      }
      return false // not handled, let input process it
    },
    [showShortcuts, showCommands, showContext, inputValue, selectedCommandIndex],
  )

  // Global keyboard handler for Ctrl+C and backspace to close panels
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
        // Backspace closes shortcuts/context panels when input is empty
        if (key.name === 'backspace' && inputValue.length === 0 && (showShortcuts || showContext)) {
          setShowShortcuts(false)
          setShowContext(false)
        }
      },
      [inputValue, setInputValue, showShortcuts, showContext],
    ),
  )

  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      handleSendMessage(initialPrompt)
    }
  }, [])

  // Reset selected command index when input changes (to keep it in valid range)
  useEffect(() => {
    if (showCommands) {
      const filtered = searchCommands(inputValue)
      if (selectedCommandIndex >= filtered.length) {
        setSelectedCommandIndex(Math.max(0, filtered.length - 1))
      }
    }
  }, [inputValue, showCommands, selectedCommandIndex])

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
          {messages.map((msg) => (
            <box key={msg.id} style={{ marginBottom: 1 }}>
              <text style={{ fg: theme.muted, wrapMode: 'word' }}>
                {msg.variant === 'user' ? '> ' : ''}
                {msg.isStreaming && !msg.content ? (
                  <ShimmerText text="Thinking..." primaryColor="#808080" interval={120} />
                ) : (
                  <>
                    {msg.content}
                    {msg.isStreaming ? '▌' : ''}
                  </>
                )}
              </text>
            </box>
          ))}
        </scrollbox>

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
          />

          {/* Shortcuts panel - shown below input when ? is pressed */}
          {showShortcuts && (
            <box style={{ flexDirection: 'row', marginLeft: 1, marginTop: 1, gap: 2 }}>
              <box style={{ flexDirection: 'column' }}>
                <text style={{ fg: theme.muted }}>/ for commands</text>
                <text style={{ fg: theme.muted }}>@ for file paths</text>
                <text style={{ fg: theme.muted }}># to memorize</text>
                <text style={{ fg: theme.muted }}>* threads</text>
              </box>
              <box style={{ flexDirection: 'column' }}>
                <text style={{ fg: theme.muted }}>⇧tab switch models</text>
                <text style={{ fg: theme.muted }}>⇧m switch modes</text>
                <text style={{ fg: theme.muted }}>esc to cancel</text>
              </box>
              <box style={{ flexDirection: 'column' }}>
                <text style={{ fg: theme.muted }}>ctrl+c exit</text>
                <text style={{ fg: theme.muted }}>⇧↵ for newline</text>
                <text style={{ fg: theme.muted }}>ctrl+v paste</text>
              </box>
            </box>
          )}

          {/* Commands panel - shown below input when / is pressed */}
          {showCommands && (() => {
            const filteredCommands = searchCommands(inputValue)
            if (filteredCommands.length === 0) return null
            // Clamp selected index to valid range
            const clampedIndex = Math.min(selectedCommandIndex, filteredCommands.length - 1)
            return (
              <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
                {filteredCommands.map((cmd, idx) => {
                  const isSelected = idx === clampedIndex
                  return (
                    <box key={cmd.name} style={{ flexDirection: 'column' }}>
                      <text style={{ fg: theme.slashCommandFg }}>
                        {isSelected ? (
                          <ShimmerText
                            text={cmd.name}
                            primaryColor={theme.slashCommandFg}
                            interval={80}
                          />
                        ) : (
                          cmd.name
                        )}
                      </text>
                      <text style={{ fg: theme.muted, marginLeft: 2 }}>{cmd.description}</text>
                    </box>
                  )
                })}
              </box>
            )
          })()}

          {/* Context panel - shown below input when * is pressed */}
          {showContext && (
            <box style={{ flexDirection: 'row', marginLeft: 1, marginTop: 1, gap: 2 }}>
              <box style={{ flexDirection: 'column' }}>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>switch</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>new</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>handoff</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>fork</span></text>
              </box>
              <box style={{ flexDirection: 'column' }}>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>switch to previous</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>switch to parent</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>set visibility</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>share with support</span></text>
              </box>
              <box style={{ flexDirection: 'column' }}>
                <text style={{ fg: theme.muted }}>prompt  <span fg={theme.foreground}>open in editor</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>open in browser</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>copy url</span></text>
                <text style={{ fg: theme.muted }}>thread  <span fg={theme.foreground}>toggle thinking</span></text>
              </box>
            </box>
          )}
        </box>
      </box>

      {/* Sidebar - full height */}
      <box
        style={{
          width: sidebarWidth,
          borderStyle: 'single',
          borderColor: theme.borderMuted,
          marginRight: 1,
          marginTop: 1,
          marginBottom: 1,
          padding: 1,
          flexDirection: 'column',
        }}
      >
        <text content={t`${yellow('-->|')}`} /><text style={{ fg: theme.muted }}> /init to start</text>
        <text style={{ fg: theme.muted, marginTop: 1 }}>Plan</text>
      </box>
    </box>
  )
}
