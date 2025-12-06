import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { searchCommands, searchContext } from '../utils/trie'
import { MODELS, CYCLABLE_MODES } from '../constants/app-constants'
import type { ToolCall, ChatMessage } from '../types/chat'
import type { ContextFocusPhase } from '../components/panels/ContextPanel'
import { useWorktreeNavigation } from './use-worktree-navigation'
import { useThreadStore } from '../state/thread-store'
import { saveMessage } from '../services/message-persistence'

interface InputValue {
  text: string
  cursorPosition: number
  lastEditDueToNav: boolean
}

interface UseAppKeyboardOptions {
  inputValue: string
  setInputValue: (val: InputValue) => void
  handleSendMessage: (content: string) => void
  isStreaming: boolean
  cancelStream: () => void
  toolCalls: ToolCall[]
  toggleExpandedTool: (id: string) => void
  modelIndex: number
  setModelIndex: (fn: (prev: number) => number) => void
  modeIndex: number
  setModeIndex: (fn: (prev: number) => number) => void
  // Thinking mode
  thinkingEnabled: boolean
  setThinkingEnabled: (fn: (prev: boolean) => boolean) => void
  // Smart shortcut
  smartShortcut: string | null
  setSmartShortcut: (shortcut: string | null) => void
  // Status panel
  showStatusPanel?: boolean
  setShowStatusPanel?: (show: boolean) => void
  // Config panel
  showConfigPanel?: boolean
  setShowConfigPanel?: (show: boolean) => void
  // Message handling for compact summary
  addMessage?: (message: ChatMessage) => void
  clearMessages?: () => void
}

export function useAppKeyboard({
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
  thinkingEnabled,
  setThinkingEnabled,
  smartShortcut,
  setSmartShortcut,
  showStatusPanel,
  setShowStatusPanel,
  showConfigPanel,
  setShowConfigPanel,
  addMessage,
  clearMessages,
}: UseAppKeyboardOptions) {
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0)
  const [pendingExit, setPendingExit] = useState(false)
  const [contextFocusPhase, setContextFocusPhase] = useState<ContextFocusPhase>('menu')
  const pendingExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // For double ?? detection
  const lastQuestionMarkTime = useRef(0)

  // Worktree navigation
  const worktreeNav = useWorktreeNavigation()
  const switchThread = useThreadStore((state) => state.switchThread)
  const forkThread = useThreadStore((state) => state.forkThread)
  const compactThread = useThreadStore((state) => state.compactThread)
  const addMessageToThread = useThreadStore((state) => state.addMessageToThread)
  const currentThreadId = useThreadStore((state) => state.currentThreadId)

  // Track what action triggered worktree open: 'switch' or 'fork'
  const [worktreeAction, setWorktreeAction] = useState<'switch' | 'fork'>('switch')

  // Key intercept for input - handles Shift+M before input processes it
  const handleKeyIntercept = useCallback(
    (key: KeyEvent): boolean => {
      // Let ConfigPanel handle its own keyboard events
      if (showConfigPanel) {
        return false // don't intercept, let ConfigPanel handle it
      }

      // Close status panel on any keypress
      if (showStatusPanel && setShowStatusPanel) {
        setShowStatusPanel(false)
        return true // consume the key
      }

      // Shift+M: cycle through modes (only cyclable modes, not school)
      if (key.shift && key.name === 'm') {
        setModeIndex((prev) => (prev + 1) % CYCLABLE_MODES.length)
        return true // handled, don't process further
      }
      // Shift+Tab: cycle through models
      if (key.shift && key.name === 'tab') {
        setModelIndex((prev) => (prev + 1) % MODELS.length)
        return true
      }
      // Shift+T: toggle thinking mode
      if (key.shift && key.name === 't') {
        setThinkingEnabled((prev) => !prev)
        return true
      }
      // ?: toggle shortcuts panel (only when input is empty and not showing commands)
      if (key.sequence === '?' && inputValue.length === 0) {
        if (showCommands) {
          // do nothing if commands panel is open
          return true
        }
        setShowContext(false)
        setShowShortcuts((prev) => !prev)
        return true
      }
      // *: show context panel, exit shortcuts/commands if open
      if (key.sequence === '*' && inputValue.length === 0) {
        setShowShortcuts(false)
        setShowCommands(false)
        setShowContext(true)
        setSelectedMenuIndex(0)
        return false // let it type the *
      }
      // /: show commands panel, exit shortcuts/context if open
      if (key.sequence === '/' && inputValue.length === 0) {
        setShowShortcuts(false)
        setShowContext(false)
        setShowCommands(true)
        setSelectedMenuIndex(0)
        return false // let it type the /
      }
      // Arrow keys: navigate command menu, context menu, or worktree
      if ((showCommands || showContext) && (key.name === 'up' || key.name === 'down')) {
        // If in worktree phase, navigate the tree
        if (showContext && contextFocusPhase === 'worktree') {
          if (key.name === 'up') {
            worktreeNav.navigateUp()
          } else {
            worktreeNav.navigateDown()
          }
          return true
        }

        // Otherwise navigate menu items
        const filtered = showCommands ? searchCommands(inputValue) : searchContext(inputValue)
        if (filtered.length > 0) {
          if (key.name === 'up') {
            setSelectedMenuIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
          } else {
            setSelectedMenuIndex((prev) => (prev + 1) % filtered.length)
          }
        }
        return true // consume the key
      }

      // In worktree phase: any key except Enter/arrows goes back to menu phase
      if (showContext && contextFocusPhase === 'worktree') {
        const isNavigationKey = key.name === 'up' || key.name === 'down' || key.name === 'return' || key.name === 'enter'
        if (!isNavigationKey) {
          // Go back to menu phase (compact/fork/switch selection)
          setContextFocusPhase('menu')
          setWorktreeAction('switch') // Reset to default
          return true
        }
      }
      // Tab with empty input and no menu: send smart shortcut from queue
      if (key.name === 'tab' && inputValue.length === 0 && !showCommands && !showContext && smartShortcut) {
        handleSendMessage(smartShortcut)
        setSmartShortcut(null) // Clear - next suggestion will replace it
        return true
      }
      // Tab: autocomplete selected item (commands or context menu)
      if ((showCommands || showContext) && key.name === 'tab' && contextFocusPhase === 'menu') {
        const filtered = showCommands ? searchCommands(inputValue) : searchContext(inputValue)
        if (filtered.length > 0) {
          const selected = filtered[selectedMenuIndex] ?? filtered[0]
          setInputValue({ text: selected.name + ' ', cursorPosition: selected.name.length + 1, lastEditDueToNav: false })
          setShowCommands(false)
          setShowContext(false)
          setSelectedMenuIndex(0)
        }
        return true // consume the key
      }
      // Enter: select item from command menu or context menu
      if ((showCommands || showContext) && (key.name === 'return' || key.name === 'enter')) {
        // If in worktree phase, handle based on action (switch or fork)
        if (showContext && contextFocusPhase === 'worktree' && worktreeNav.selectedThreadId) {
          if (worktreeAction === 'fork') {
            // Fork from selected thread
            forkThread(worktreeNav.selectedThreadId, '')
          } else {
            // Switch to selected thread
            switchThread(worktreeNav.selectedThreadId)
          }
          setShowContext(false)
          setContextFocusPhase('menu')
          setWorktreeAction('switch') // Reset to default
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return true
        }

        const filtered = showCommands ? searchCommands(inputValue) : searchContext(inputValue)
        if (filtered.length > 0) {
          const selected = filtered[selectedMenuIndex] ?? filtered[0]
          const cmd = selected.name.toLowerCase()

          // Handle context items that open worktree (don't close panel, keep input)
          if (cmd === '*fork') {
            // Open worktree to select WHERE to fork from
            setWorktreeAction('fork')
            setContextFocusPhase('worktree')
            worktreeNav.initializeSelection()
            // Don't clear input - keeps panel open
            return true
          }
          if (cmd === '*switch') {
            // Open worktree to navigate and switch to any block
            setWorktreeAction('switch')
            setContextFocusPhase('worktree')
            worktreeNav.initializeSelection()
            // Don't clear input - keeps panel open
            return true
          }

          // For all other commands, close the panels first
          setShowCommands(false)
          setShowContext(false)
          setSelectedMenuIndex(0)
          setContextFocusPhase('menu')
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

          // Handle local commands
          if (cmd === '/school') {
            // Toggle school mode (index 4) - if already in school, go back to stealth (0)
            setModeIndex((prev) => prev === 4 ? 0 : 4)
            return true
          }
          if (cmd === '/exit' || cmd === '/quit') {
            process.exit(0)
          }
          if (cmd === '/clear' || cmd === '/reset' || cmd === '/new') {
            // TODO: Clear conversation history
            return true
          }
          if (cmd === '/context' || cmd === '/status') {
            if (setShowStatusPanel) setShowStatusPanel(true)
            return true
          }
          if (cmd === '/config' || cmd === '/theme') {
            if (setShowConfigPanel) setShowConfigPanel(true)
            return true
          }
          if (cmd === '/init' || cmd === '/doctor' || cmd === '/login' ||
              cmd === '/logout' || cmd === '/add-dir' || cmd === '/agents') {
            // TODO: Implement these commands
            return true
          }

          // Slash commands should not be sent to AI - only context items (*)
          if (cmd.startsWith('/')) {
            return true
          }

          // Handle context item *compact
          if (cmd === '*compact') {
            // Create new compact block after current and move there (async)
            void (async () => {
              const { threadId, summary } = await compactThread()
              if (threadId && summary && addMessage && clearMessages) {
                // Clear existing messages first
                clearMessages()
                // Clear terminal screen (ANSI escape: clear screen + move cursor home)
                process.stdout.write('\x1b[2J\x1b[H')
                // Add system message with summary to the new thread
                const summaryMessage: ChatMessage = {
                  id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                  variant: 'system',
                  content: `📦 Previous conversation: ${summary}`,
                  timestamp: new Date(),
                  isComplete: true,
                }
                addMessage(summaryMessage)
                // Persist and link to thread
                saveMessage(summaryMessage)
                addMessageToThread(threadId, summaryMessage.id)
              }
            })()
            return true
          }

          // Other context items - send to AI
          handleSendMessage(selected.name)
          return true
        }
        // No matches - close menus and let normal submit handle it
        setShowCommands(false)
        setShowContext(false)
        setSelectedMenuIndex(0)
        setContextFocusPhase('menu')
        return false
      }
      // Space: close menu panels (item is complete)
      if (key.sequence === ' ' && (showCommands || showContext)) {
        setShowCommands(false)
        setShowContext(false)
        return false // let it type the space
      }
      // Backspace: close panel if input will no longer start with / or *
      if (key.name === 'backspace' && (showCommands || showContext)) {
        if (inputValue === '/' || inputValue === '*' || (!inputValue.startsWith('/') && !inputValue.startsWith('*'))) {
          setShowCommands(false)
          setShowContext(false)
        }
        return false // let it delete the character
      }
      // Escape: close panels and reset focus phase
      if (key.name === 'escape' && (showShortcuts || showCommands || showContext)) {
        setShowShortcuts(false)
        setShowCommands(false)
        setShowContext(false)
        setContextFocusPhase('menu')
        setWorktreeAction('switch') // Reset to default
        return true
      }
      return false // not handled, let input process it
    },
    [showShortcuts, showCommands, showContext, showStatusPanel, setShowStatusPanel, showConfigPanel, inputValue, selectedMenuIndex, handleSendMessage, setInputValue, setModelIndex, setModeIndex, setThinkingEnabled, smartShortcut, setSmartShortcut, contextFocusPhase, worktreeNav, switchThread, forkThread, compactThread, addMessageToThread, addMessage, clearMessages, currentThreadId, worktreeAction],
  )

  // Global keyboard handler for Ctrl+C, Ctrl+O, Escape, and backspace
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        // Let ConfigPanel handle its own keyboard events
        if (showConfigPanel) {
          return
        }

        // Escape: cancel streaming if active
        if (key.name === 'escape' && isStreaming) {
          cancelStream()
          return
        }

        // Ctrl+O: toggle expand last completed tool
        if (key.ctrl && key.name === 'o') {
          const completedTools = toolCalls.filter((t) => t.status === 'complete' && t.fullResult)
          if (completedTools.length > 0) {
            const lastTool = completedTools[completedTools.length - 1]
            toggleExpandedTool(lastTool.id)
          }
          return
        }

        if (key.ctrl && key.name === 'c') {
          // Ctrl+C while streaming: cancel the stream
          if (isStreaming) {
            cancelStream()
            return
          }

          if (inputValue.length > 0) {
            // Clear input and reset pending exit
            setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
            setPendingExit(false)
            if (pendingExitTimerRef.current) {
              clearTimeout(pendingExitTimerRef.current)
              pendingExitTimerRef.current = null
            }
          } else if (pendingExit) {
            // Second ctrl+c with empty input - actually exit
            process.exit(0)
          } else {
            // First ctrl+c with empty input - set pending and show warning in input box
            setPendingExit(true)
            // Reset after 3 seconds
            if (pendingExitTimerRef.current) {
              clearTimeout(pendingExitTimerRef.current)
            }
            pendingExitTimerRef.current = setTimeout(() => {
              setPendingExit(false)
              pendingExitTimerRef.current = null
            }, 3000)
          }
        }
        // Backspace closes shortcuts/context panels when input is empty
        if (key.name === 'backspace' && inputValue.length === 0 && (showShortcuts || showContext)) {
          setShowShortcuts(false)
          setShowContext(false)
        }
        // Any other key resets pending exit
        if (!key.ctrl && key.name !== 'c' && pendingExit) {
          setPendingExit(false)
          if (pendingExitTimerRef.current) {
            clearTimeout(pendingExitTimerRef.current)
            pendingExitTimerRef.current = null
          }
        }
      },
      [inputValue, setInputValue, showShortcuts, showContext, pendingExit, isStreaming, cancelStream, toolCalls, toggleExpandedTool, showConfigPanel],
    ),
  )

  // Reset selected menu index when input changes (to keep it in valid range)
  useEffect(() => {
    if (showCommands || showContext) {
      const filtered = showCommands ? searchCommands(inputValue) : searchContext(inputValue)
      if (selectedMenuIndex >= filtered.length) {
        setSelectedMenuIndex(Math.max(0, filtered.length - 1))
      }
    }
  }, [inputValue, showCommands, showContext, selectedMenuIndex])

  return {
    handleKeyIntercept,
    showShortcuts,
    showCommands,
    showContext,
    selectedMenuIndex,
    pendingExit,
    setShowShortcuts,
    setShowCommands,
    setShowContext,
    // Worktree navigation
    contextFocusPhase,
    worktreeSelectedId: worktreeNav.selectedThreadId,
    worktreeAction,
  }
}
