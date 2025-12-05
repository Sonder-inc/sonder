import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { searchCommands, searchContext } from '../utils/trie'
import { MODELS, MODES } from '../constants/app-constants'
import type { ToolCall } from '../types/chat'

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
  // Smart shortcut
  smartShortcut: string | null
  setSmartShortcut: (shortcut: string | null) => void
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
  smartShortcut,
  setSmartShortcut,
}: UseAppKeyboardOptions) {
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0)
  const [pendingExit, setPendingExit] = useState(false)
  const pendingExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      // Arrow keys: navigate command menu or context menu
      if ((showCommands || showContext) && (key.name === 'up' || key.name === 'down')) {
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
      // Tab with empty input and no menu: send smart shortcut from queue
      if (key.name === 'tab' && inputValue.length === 0 && !showCommands && !showContext && smartShortcut) {
        handleSendMessage(smartShortcut)
        setSmartShortcut(null) // Clear - next suggestion will replace it
        return true
      }
      // Tab: autocomplete selected item (just fill in, don't submit)
      if ((showCommands || showContext) && key.name === 'tab') {
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
        const filtered = showCommands ? searchCommands(inputValue) : searchContext(inputValue)
        if (filtered.length > 0) {
          const selected = filtered[selectedMenuIndex] ?? filtered[0]
          setShowCommands(false)
          setShowContext(false)
          setSelectedMenuIndex(0)
          handleSendMessage(selected.name)
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return true // consume the key only when we matched a command
        }
        // No matches - close menus and let normal submit handle it
        setShowCommands(false)
        setShowContext(false)
        setSelectedMenuIndex(0)
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
      // Escape: close panels
      if (key.name === 'escape' && (showShortcuts || showCommands || showContext)) {
        setShowShortcuts(false)
        setShowCommands(false)
        setShowContext(false)
        return true
      }
      return false // not handled, let input process it
    },
    [showShortcuts, showCommands, showContext, inputValue, selectedMenuIndex, handleSendMessage, setInputValue, setModelIndex, setModeIndex, smartShortcut, setSmartShortcut],
  )

  // Global keyboard handler for Ctrl+C, Ctrl+O, Escape, and backspace
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
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
      [inputValue, setInputValue, showShortcuts, showContext, pendingExit, isStreaming, cancelStream, toolCalls, toggleExpandedTool],
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
  }
}
