import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type {
  PasteEvent,
  ScrollBoxRenderable,
  TextBufferView,
  TextRenderable,
} from '@opentui/core'

import { useTheme } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { useCursorBlink } from '../../hooks/use-cursor-blink'
import { useInputKeyboard } from '../../hooks/use-input-keyboard'
import { TAB_WIDTH, calculateRenderPosition } from '../../utils/text-editing'
import { CursorRenderer } from './CursorRenderer'
import type { MultilineInputProps, MultilineInputHandle } from './types'

export const MultilineInput = forwardRef<MultilineInputHandle, MultilineInputProps>(
  function MultilineInput(
    {
      value,
      onChange,
      onSubmit,
      placeholder = '',
      focused = true,
      shouldBlinkCursor,
      hideCursor = false,
      maxHeight = 5,
      minHeight = 1,
      width,
      onKeyIntercept,
      cursorPosition,
    }: MultilineInputProps,
    forwardedRef
  ) {
    const theme = useTheme()
    const hookBlinkValue = useChatStore((state) => state.isFocusSupported)
    const effectiveShouldBlinkCursor = shouldBlinkCursor ?? hookBlinkValue

    const scrollBoxRef = useRef<ScrollBoxRenderable | null>(null)
    const textRef = useRef<TextRenderable | null>(null)
    const [measuredCols, setMeasuredCols] = useState<number | null>(null)

    const valueRef = useRef(value)
    const cursorPositionRef = useRef(cursorPosition)

    useEffect(() => {
      valueRef.current = value
      cursorPositionRef.current = cursorPosition
    }, [value, cursorPosition])

    // Cursor blink
    const cursorVisible = useCursorBlink({
      focused,
      shouldBlink: effectiveShouldBlinkCursor,
      resetDependencies: [value, cursorPosition],
    })

    // Keyboard handling
    useInputKeyboard({
      focused,
      value,
      cursorPosition,
      onChange,
      onSubmit,
      onKeyIntercept,
    })

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
      []
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
      [focused, onChange]
    )

    // Scroll to cursor row
    const cursorRow = lineInfo
      ? Math.max(
          0,
          lineInfo.lineStarts.findLastIndex(
            (lineStart: number) => lineStart <= cursorPosition
          )
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

    // Measure viewport width
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

    // Display values
    const isPlaceholder = value.length === 0 && placeholder.length > 0
    const displayValue = isPlaceholder ? placeholder : value
    const showCursor = focused && !hideCursor
    const displayValueForRendering = displayValue.replace(/\t/g, ' '.repeat(TAB_WIDTH))
    const renderCursorPosition = calculateRenderPosition(displayValue, cursorPosition)

    // Slash command detection
    const slashCommandEnd = (() => {
      if (!value.startsWith('/')) return 0
      const spaceIdx = value.indexOf(' ')
      return spaceIdx === -1 ? value.length : spaceIdx
    })()

    // Layout metrics
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
            paddingLeft: 0,
            paddingRight: 0,
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
          <CursorRenderer
            displayValue={displayValue}
            displayValueForRendering={displayValueForRendering}
            cursorPosition={cursorPosition}
            renderCursorPosition={renderCursorPosition}
            isPlaceholder={isPlaceholder}
            cursorVisible={cursorVisible}
            showCursor={showCursor}
            slashCommandEnd={slashCommandEnd}
            theme={theme}
          />
        </text>
      </scrollbox>
    )
  }
)

export type { MultilineInputHandle }
