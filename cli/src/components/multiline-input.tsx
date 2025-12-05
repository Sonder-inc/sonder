import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import { InputCursor } from './input-cursor'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'

import type { InputValue } from '../state/chat-store'
import type {
  KeyEvent,
  PasteEvent,
  ScrollBoxRenderable,
  TextBufferView,
  TextRenderable,
} from '@opentui/core'

// Helper functions for text manipulation
function findLineStart(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  while (pos > 0 && text[pos - 1] !== '\n') {
    pos--
  }
  return pos
}

function findLineEnd(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  while (pos < text.length && text[pos] !== '\n') {
    pos++
  }
  return pos
}

function findPreviousWordBoundary(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  while (pos > 0 && /\s/.test(text[pos - 1]!)) {
    pos--
  }
  while (pos > 0 && !/\s/.test(text[pos - 1]!)) {
    pos--
  }
  return pos
}

function findNextWordBoundary(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  while (pos < text.length && !/\s/.test(text[pos]!)) {
    pos++
  }
  while (pos < text.length && /\s/.test(text[pos]!)) {
    pos++
  }
  return pos
}

const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f]/
const TAB_WIDTH = 4

function preventKeyDefault(key: { preventDefault?: () => void } | null | undefined) {
  key?.preventDefault?.()
}

interface MultilineInputProps {
  value: string
  onChange: (value: InputValue) => void
  onSubmit: () => void
  onKeyIntercept?: (key: KeyEvent) => boolean
  placeholder?: string
  focused?: boolean
  shouldBlinkCursor?: boolean
  maxHeight?: number
  minHeight?: number
  width: number
  textAttributes?: number
  cursorPosition: number
}

export type MultilineInputHandle = {
  focus: () => void
}

export const MultilineInput = forwardRef<MultilineInputHandle, MultilineInputProps>(
  function MultilineInput(
    {
      value,
      onChange,
      onSubmit,
      placeholder = '',
      focused = true,
      shouldBlinkCursor,
      maxHeight = 5,
      minHeight = 1,
      width,
      onKeyIntercept,
      cursorPosition,
    }: MultilineInputProps,
    forwardedRef,
  ) {
    const theme = useTheme()
    const hookBlinkValue = useChatStore((state) => state.isFocusSupported)
    const effectiveShouldBlinkCursor = shouldBlinkCursor ?? hookBlinkValue

    const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null)
    const [measuredCols, setMeasuredCols] = useState<number | null>(null)
    const [lastActivity, setLastActivity] = useState(Date.now())

    const valueRef = useRef(value)
    const cursorPositionRef = useRef(cursorPosition)

    useEffect(() => {
      valueRef.current = value
      cursorPositionRef.current = cursorPosition
    }, [value, cursorPosition])

    useEffect(() => {
      setLastActivity(Date.now())
    }, [value, cursorPosition])

    const textRef = useRef<TextRenderable | null>(null)

    const lineInfo = textRef.current
      ? ((textRef.current satisfies TextRenderable as any).textBufferView as TextBufferView)
          .lineInfo
      : null

    useImperativeHandle(
      forwardedRef,
      () => ({
        focus: () => {
          const node = scrollBoxRef.current
          if (node && typeof (node as any).focus === 'function') {
            ;(node as any).focus()
          }
        },
      }),
      [],
    )

    const handlePaste = useCallback(
      (event: PasteEvent) => {
        if (!focused) return

        const text = event.text ?? ''
        if (!text) return

        const currentValue = valueRef.current
        const currentCursor = cursorPositionRef.current

        const newValue =
          currentValue.slice(0, currentCursor) + text + currentValue.slice(currentCursor)
        const newCursor = currentCursor + text.length

        valueRef.current = newValue
        cursorPositionRef.current = newCursor

        onChange({
          text: newValue,
          cursorPosition: newCursor,
          lastEditDueToNav: false,
        })
      },
      [focused, onChange],
    )

    const cursorRow = lineInfo
      ? Math.max(
          0,
          lineInfo.lineStarts.findLastIndex(
            (lineStart: number) => lineStart <= cursorPosition,
          ),
        )
      : 0

    useEffect(() => {
      const scrollBox = scrollBoxRef.current
      if (scrollBox && focused) {
        const maxScroll = scrollBox.scrollHeight - scrollBox.viewport.height
        const minScroll = Math.max(0, cursorRow - scrollBox.viewport.height + 1)
        const scrollPosition = Math.max(minScroll, Math.min(maxScroll, cursorRow))
        scrollBox.verticalScrollBar.scrollPosition = scrollPosition
      }
    }, [cursorPosition, focused, cursorRow])

    useEffect(() => {
      const node = scrollBoxRef.current
      if (!node) return
      const viewportWidth = Number(node.viewport?.width ?? 0)
      if (!Number.isFinite(viewportWidth)) return
      const vpWidth = Math.floor(viewportWidth)
      if (vpWidth <= 0) return
      const cols = Math.max(1, vpWidth)
      setMeasuredCols(cols)
    }, [width])

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
      [cursorPosition, onChange, value],
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
      [cursorPosition, onChange, value],
    )

    const isPlaceholder = value.length === 0 && placeholder.length > 0
    const displayValue = isPlaceholder ? placeholder : value
    const showCursor = focused

    const displayValueForRendering = displayValue.replace(/\t/g, ' '.repeat(TAB_WIDTH))

    let renderCursorPosition = 0
    for (let i = 0; i < cursorPosition && i < displayValue.length; i++) {
      renderCursorPosition += displayValue[i] === '\t' ? TAB_WIDTH : 1
    }

    // Detect slash command: starts with "/" and ends at first space or end of string
    const slashCommandEnd = (() => {
      if (!value.startsWith('/')) return 0
      const spaceIdx = value.indexOf(' ')
      return spaceIdx === -1 ? value.length : spaceIdx
    })()

    const { beforeCursor, afterCursor, activeChar, shouldHighlight } = (() => {
      if (!showCursor) {
        return {
          beforeCursor: '',
          afterCursor: '',
          activeChar: ' ',
          shouldHighlight: false,
        }
      }

      const beforeCursor = displayValueForRendering.slice(0, renderCursorPosition)
      const afterCursor = displayValueForRendering.slice(renderCursorPosition)
      const activeChar = afterCursor.charAt(0) || ' '
      const shouldHighlight =
        !isPlaceholder &&
        renderCursorPosition < displayValueForRendering.length &&
        displayValue[cursorPosition] !== '\n' &&
        displayValue[cursorPosition] !== '\t'

      return {
        beforeCursor,
        afterCursor,
        activeChar,
        shouldHighlight,
      }
    })()

    useKeyboard(
      useCallback(
        (key: KeyEvent) => {
          if (!focused) return

          if (onKeyIntercept) {
            const handled = onKeyIntercept(key)
            if (handled) {
              return
            }
          }

          const lowerKeyName = (key.name ?? '').toLowerCase()
          const ESC = '\x1b'
          const isAltLikeModifier = Boolean(
            key.option ||
              (key.sequence?.length === 2 &&
                key.sequence[0] === ESC &&
                key.sequence[1] !== '['),
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

          // Up arrow
          if (key.name === 'up' && !key.ctrl && !key.meta && !key.option) {
            preventKeyDefault(key)
            // Simple implementation: go to start
            moveCursor(0)
            return
          }

          // Down arrow
          if (key.name === 'down' && !key.ctrl && !key.meta && !key.option) {
            preventKeyDefault(key)
            // Simple implementation: go to end
            moveCursor(value.length)
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
        ],
      ),
    )

    const layoutMetrics = (() => {
      const safeMaxHeight = Math.max(1, maxHeight)
      const effectiveMinHeight = Math.max(1, Math.min(minHeight, safeMaxHeight))
      const totalLines =
        measuredCols === 0 || lineInfo === null ? 1 : lineInfo.lineStarts.length
      const rawHeight = Math.min(totalLines, safeMaxHeight)
      const heightLines = Math.max(effectiveMinHeight, rawHeight)
      return { heightLines }
    })()

    const inputColor = isPlaceholder
      ? theme.muted
      : focused
        ? theme.inputFocusedFg
        : theme.inputFg

    const highlightBg = '#7dd3fc'

    return (
      <scrollbox
        ref={scrollBoxRef}
        scrollX={false}
        stickyScroll={true}
        stickyStart="bottom"
        scrollbarOptions={{ visible: false }}
        onPaste={handlePaste}
        style={{
          flexGrow: 0,
          flexShrink: 0,
          rootOptions: {
            width: '100%',
            height: layoutMetrics.heightLines,
            backgroundColor: 'transparent',
            flexGrow: 0,
            flexShrink: 0,
          },
          wrapperOptions: {
            paddingLeft: 1,
            paddingRight: 1,
            border: false,
          },
          contentOptions: {
            justifyContent: 'flex-start',
          },
        }}
      >
        <text
          ref={textRef}
          style={{ bg: 'transparent', fg: inputColor, wrapMode: 'word' }}
        >
          {showCursor ? (
            <>
              {/* Render beforeCursor with slash command highlighting */}
              {slashCommandEnd > 0 && renderCursorPosition > 0 ? (
                <>
                  <span fg={theme.slashCommandFg}>
                    {beforeCursor.slice(0, Math.min(slashCommandEnd, renderCursorPosition))}
                  </span>
                  {renderCursorPosition > slashCommandEnd && beforeCursor.slice(slashCommandEnd)}
                </>
              ) : (
                beforeCursor
              )}
              {shouldHighlight ? (
                <span
                  bg={highlightBg}
                  fg={theme.background}
                  attributes={TextAttributes.BOLD}
                >
                  {activeChar === ' ' ? '\u00a0' : activeChar}
                </span>
              ) : (
                <InputCursor
                  visible={true}
                  focused={focused}
                  shouldBlink={effectiveShouldBlinkCursor}
                  color={theme.muted}
                  key={lastActivity}
                />
              )}
              {/* Render afterCursor with slash command highlighting */}
              {(() => {
                const textAfter = shouldHighlight
                  ? afterCursor.length > 0
                    ? afterCursor.slice(1)
                    : ''
                  : afterCursor
                if (slashCommandEnd > renderCursorPosition && textAfter.length > 0) {
                  const cmdRemaining = slashCommandEnd - renderCursorPosition - (shouldHighlight ? 1 : 0)
                  if (cmdRemaining > 0) {
                    return (
                      <>
                        <span fg={theme.slashCommandFg}>{textAfter.slice(0, cmdRemaining)}</span>
                        {textAfter.slice(cmdRemaining)}
                      </>
                    )
                  }
                }
                return textAfter
              })()}
            </>
          ) : (
            <>
              {slashCommandEnd > 0 ? (
                <>
                  <span fg={theme.slashCommandFg}>{displayValueForRendering.slice(0, slashCommandEnd)}</span>
                  {displayValueForRendering.slice(slashCommandEnd)}
                </>
              ) : (
                displayValueForRendering
              )}
            </>
          )}
        </text>
      </scrollbox>
    )
  },
)
