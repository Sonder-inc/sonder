import { useCallback } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import type { InputValue } from '../types/chat'
import {
  findLineStart,
  findLineEnd,
  findPreviousWordBoundary,
  findNextWordBoundary,
} from '../utils/text-navigation'
import { CONTROL_CHAR_REGEX, preventKeyDefault } from '../utils/text-editing'

interface UseInputKeyboardOptions {
  focused: boolean
  value: string
  cursorPosition: number
  onChange: (value: InputValue) => void
  onSubmit: () => void
  onKeyIntercept?: (key: KeyEvent) => boolean
}

/**
 * Hook for handling keyboard input in multiline text input
 */
export function useInputKeyboard({
  focused,
  value,
  cursorPosition,
  onChange,
  onSubmit,
  onKeyIntercept,
}: UseInputKeyboardOptions): void {
  const insertTextAtCursor = useCallback(
    (textToInsert: string) => {
      if (!textToInsert) return
      const newValue =
        value.slice(0, cursorPosition) + textToInsert + value.slice(cursorPosition)
      onChange({
        text: newValue,
        cursorPosition: cursorPosition + textToInsert.length,
        lastEditDueToNav: false,
      })
    },
    [cursorPosition, onChange, value]
  )

  const moveCursor = useCallback(
    (nextPosition: number) => {
      const clamped = Math.max(0, Math.min(value.length, nextPosition))
      if (clamped === cursorPosition) return
      onChange({
        text: value,
        cursorPosition: clamped,
        lastEditDueToNav: false,
      })
    },
    [cursorPosition, onChange, value]
  )

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (!focused) return

        if (onKeyIntercept) {
          const handled = onKeyIntercept(key)
          if (handled) return
        }

        const lowerKeyName = (key.name ?? '').toLowerCase()
        const ESC = '\x1b'
        const isAltLikeModifier = Boolean(
          key.option ||
            (key.sequence?.length === 2 &&
              key.sequence[0] === ESC &&
              key.sequence[1] !== '[')
        )

        const isEnterKey = key.name === 'return' || key.name === 'enter'
        const hasEscapePrefix =
          typeof key.sequence === 'string' &&
          key.sequence.length > 0 &&
          key.sequence.charCodeAt(0) === 0x1b
        const hasBackslashBeforeCursor =
          cursorPosition > 0 && value[cursorPosition - 1] === '\\'

        const isPlainEnter =
          isEnterKey &&
          !key.shift &&
          !key.ctrl &&
          !key.meta &&
          !key.option &&
          !isAltLikeModifier &&
          !hasEscapePrefix &&
          key.sequence === '\r' &&
          !hasBackslashBeforeCursor
        const isShiftEnter =
          isEnterKey && (Boolean(key.shift) || key.sequence === '\n')
        const isOptionEnter = isEnterKey && (isAltLikeModifier || hasEscapePrefix)
        const isCtrlJ =
          key.ctrl && !key.meta && !key.option && (lowerKeyName === 'j' || isEnterKey)
        const isBackslashEnter = isEnterKey && hasBackslashBeforeCursor

        const shouldInsertNewline =
          isShiftEnter || isOptionEnter || isCtrlJ || isBackslashEnter

        // Handle newline insertion
        if (shouldInsertNewline) {
          preventKeyDefault(key)

          if (isBackslashEnter) {
            const newValue =
              value.slice(0, cursorPosition - 1) + '\n' + value.slice(cursorPosition)
            onChange({
              text: newValue,
              cursorPosition,
              lastEditDueToNav: false,
            })
            return
          }

          const newValue =
            value.slice(0, cursorPosition) + '\n' + value.slice(cursorPosition)
          onChange({
            text: newValue,
            cursorPosition: cursorPosition + 1,
            lastEditDueToNav: false,
          })
          return
        }

        // Handle submit
        if (isPlainEnter) {
          preventKeyDefault(key)
          onSubmit()
          return
        }

        const lineStart = findLineStart(value, cursorPosition)
        const lineEnd = findLineEnd(value, cursorPosition)
        const wordStart = findPreviousWordBoundary(value, cursorPosition)
        const wordEnd = findNextWordBoundary(value, cursorPosition)

        // Ctrl+U: Delete to line start
        if (key.ctrl && lowerKeyName === 'u' && !key.meta && !key.option) {
          preventKeyDefault(key)
          if (cursorPosition > lineStart) {
            const newValue = value.slice(0, lineStart) + value.slice(cursorPosition)
            onChange({
              text: newValue,
              cursorPosition: lineStart,
              lastEditDueToNav: false,
            })
          } else if (cursorPosition > 0) {
            const newValue =
              value.slice(0, cursorPosition - 1) + value.slice(cursorPosition)
            onChange({
              text: newValue,
              cursorPosition: cursorPosition - 1,
              lastEditDueToNav: false,
            })
          }
          return
        }

        // Alt+Backspace or Ctrl+W: Delete word backward
        if (
          (key.name === 'backspace' && isAltLikeModifier) ||
          (key.ctrl && lowerKeyName === 'w')
        ) {
          preventKeyDefault(key)
          const newValue = value.slice(0, wordStart) + value.slice(cursorPosition)
          onChange({
            text: newValue,
            cursorPosition: wordStart,
            lastEditDueToNav: false,
          })
          return
        }

        // Ctrl+K: Delete to line end
        if (key.ctrl && lowerKeyName === 'k' && !key.meta && !key.option) {
          preventKeyDefault(key)
          const newValue = value.slice(0, cursorPosition) + value.slice(lineEnd)
          onChange({ text: newValue, cursorPosition, lastEditDueToNav: true })
          return
        }

        // Basic Backspace
        if (key.name === 'backspace' && !key.ctrl && !key.meta && !key.option) {
          preventKeyDefault(key)
          if (cursorPosition > 0) {
            const newValue =
              value.slice(0, cursorPosition - 1) + value.slice(cursorPosition)
            onChange({
              text: newValue,
              cursorPosition: cursorPosition - 1,
              lastEditDueToNav: false,
            })
          }
          return
        }

        // Basic Delete
        if (key.name === 'delete' && !key.ctrl && !key.meta && !key.option) {
          preventKeyDefault(key)
          if (cursorPosition < value.length) {
            const newValue =
              value.slice(0, cursorPosition) + value.slice(cursorPosition + 1)
            onChange({
              text: newValue,
              cursorPosition,
              lastEditDueToNav: false,
            })
          }
          return
        }

        // Alt+Left: Word left
        if (isAltLikeModifier && key.name === 'left') {
          preventKeyDefault(key)
          onChange({
            text: value,
            cursorPosition: wordStart,
            lastEditDueToNav: false,
          })
          return
        }

        // Alt+Right: Word right
        if (isAltLikeModifier && key.name === 'right') {
          preventKeyDefault(key)
          onChange({
            text: value,
            cursorPosition: wordEnd,
            lastEditDueToNav: false,
          })
          return
        }

        // Cmd+Left or Ctrl+A or Home: Line start
        if (
          (key.meta && key.name === 'left' && !isAltLikeModifier) ||
          (key.ctrl && lowerKeyName === 'a' && !key.meta && !key.option) ||
          (key.name === 'home' && !key.ctrl && !key.meta)
        ) {
          preventKeyDefault(key)
          onChange({
            text: value,
            cursorPosition: lineStart,
            lastEditDueToNav: false,
          })
          return
        }

        // Cmd+Right or Ctrl+E or End: Line end
        if (
          (key.meta && key.name === 'right' && !isAltLikeModifier) ||
          (key.ctrl && lowerKeyName === 'e' && !key.meta && !key.option) ||
          (key.name === 'end' && !key.ctrl && !key.meta)
        ) {
          preventKeyDefault(key)
          onChange({
            text: value,
            cursorPosition: lineEnd,
            lastEditDueToNav: false,
          })
          return
        }

        // Cmd+Up: Document start
        if (key.meta && key.name === 'up') {
          preventKeyDefault(key)
          onChange({ text: value, cursorPosition: 0, lastEditDueToNav: false })
          return
        }

        // Cmd+Down: Document end
        if (key.meta && key.name === 'down') {
          preventKeyDefault(key)
          onChange({
            text: value,
            cursorPosition: value.length,
            lastEditDueToNav: false,
          })
          return
        }

        // Left arrow
        if (key.name === 'left' && !key.ctrl && !key.meta && !key.option) {
          preventKeyDefault(key)
          moveCursor(cursorPosition - 1)
          return
        }

        // Right arrow
        if (key.name === 'right' && !key.ctrl && !key.meta && !key.option) {
          preventKeyDefault(key)
          moveCursor(cursorPosition + 1)
          return
        }

        // Up arrow: move to previous line at same column
        if (key.name === 'up' && !key.ctrl && !key.meta && !key.option) {
          preventKeyDefault(key)
          const lines = value.split('\n')
          // Find current line and column
          let charCount = 0
          let currentLine = 0
          for (let i = 0; i < lines.length; i++) {
            const lineLen = lines[i].length
            if (charCount + lineLen >= cursorPosition) {
              currentLine = i
              break
            }
            charCount += lineLen + 1 // +1 for newline
          }
          const currentLineStart = charCount
          const currentCol = cursorPosition - currentLineStart

          if (currentLine > 0) {
            // Move to previous line at same column (or end if shorter)
            let prevLineStart = 0
            for (let i = 0; i < currentLine - 1; i++) {
              prevLineStart += lines[i].length + 1
            }
            const prevLineLen = lines[currentLine - 1].length
            moveCursor(prevLineStart + Math.min(currentCol, prevLineLen))
          } else {
            // Already on first line, go to start
            moveCursor(0)
          }
          return
        }

        // Down arrow: move to next line at same column
        if (key.name === 'down' && !key.ctrl && !key.meta && !key.option) {
          preventKeyDefault(key)
          const lines = value.split('\n')
          // Find current line and column
          let charCount = 0
          let currentLine = 0
          for (let i = 0; i < lines.length; i++) {
            const lineLen = lines[i].length
            if (charCount + lineLen >= cursorPosition) {
              currentLine = i
              break
            }
            charCount += lineLen + 1 // +1 for newline
          }
          const currentLineStart = charCount
          const currentCol = cursorPosition - currentLineStart

          if (currentLine < lines.length - 1) {
            // Move to next line at same column (or end if shorter)
            let nextLineStart = 0
            for (let i = 0; i <= currentLine; i++) {
              nextLineStart += lines[i].length + 1
            }
            const nextLineLen = lines[currentLine + 1].length
            moveCursor(nextLineStart + Math.min(currentCol, nextLineLen))
          } else {
            // Already on last line, go to end
            moveCursor(value.length)
          }
          return
        }

        // Tab: insert spaces
        if (
          key.name === 'tab' &&
          key.sequence &&
          !key.shift &&
          !key.ctrl &&
          !key.meta &&
          !key.option
        ) {
          preventKeyDefault(key)
          insertTextAtCursor('  ')
          return
        }

        // Regular character input
        if (
          key.sequence &&
          key.sequence.length === 1 &&
          !key.ctrl &&
          !key.meta &&
          !key.option &&
          !CONTROL_CHAR_REGEX.test(key.sequence)
        ) {
          preventKeyDefault(key)
          insertTextAtCursor(key.sequence)
          return
        }
      },
      [
        focused,
        value,
        cursorPosition,
        onChange,
        onSubmit,
        onKeyIntercept,
        insertTextAtCursor,
        moveCursor,
      ]
    )
  )
}
