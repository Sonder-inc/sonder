import { forwardRef, useRef } from 'react'

import { MultilineInput, type MultilineInputHandle } from './multiline-input'
import { Cursor } from './cursor'
import { useTheme } from '../hooks/use-theme'
import type { InputValue } from '../state/chat-store'
import type { KeyEvent } from '@opentui/core'

interface InputBoxProps {
  inputValue: string
  cursorPosition: number
  setInputValue: (value: InputValue | ((prev: InputValue) => InputValue)) => void
  onSubmit: () => void
  focused: boolean
  width: number
  model?: string
  mode?: string
  onKeyIntercept?: (key: KeyEvent) => boolean
  hintOverride?: string
}

export const InputBox = forwardRef<MultilineInputHandle, InputBoxProps>(
  function InputBox(
    {
      inputValue,
      cursorPosition,
      setInputValue,
      onSubmit,
      focused,
      width,
      model = 'Sonder',
      mode = 'stealth',
      onKeyIntercept,
      hintOverride,
    },
    ref,
  ) {
    const theme = useTheme()
    const inputRef = useRef<MultilineInputHandle | null>(null)

    // Forward ref
    if (ref) {
      if (typeof ref === 'function') {
        ref(inputRef.current)
      } else {
        ref.current = inputRef.current
      }
    }

    // Calculate widths
    const innerWidth = width - 2 // minus left and right border chars

    // Bottom border: ╰─── Sonder ─── stealth ─── ? for shortcuts ───╯
    const hintText = hintOverride ?? '? for shortcuts'
    const sep = ' ─── '
    const bottomContent = `─── ${model}${sep}${mode}${sep}${hintText} `
    const dashesAfter = Math.max(0, innerWidth - bottomContent.length)

    return (
      <box style={{ flexDirection: 'column', width }}>
        {/* TOP BORDER - using box like welcome banner */}
        <box style={{ flexDirection: 'row' }}>
          <text style={{ fg: theme.borderColor }}>{'╭' + '─'.repeat(innerWidth) + '╮'}</text>
        </box>

        {/* MIDDLE ROW */}
        <box style={{ flexDirection: 'row' }}>
          <text style={{ fg: theme.borderColor }}>{'│ '}</text>
          <text style={{ fg: '#888888' }}>{'> '}</text>
          {inputValue.length === 0 && <Cursor visible={focused} />}
          <box style={{ flexGrow: 1 }}>
            <MultilineInput
              ref={inputRef}
              value={inputValue}
              cursorPosition={cursorPosition}
              onChange={setInputValue}
              onSubmit={onSubmit}
              placeholder=""
              focused={focused}
              width={innerWidth - 4}
              maxHeight={5}
              minHeight={1}
              onKeyIntercept={onKeyIntercept}
              hideCursor={inputValue.length === 0}
            />
          </box>
          <text style={{ fg: theme.borderColor }}>{'│'}</text>
        </box>

        {/* BOTTOM BORDER */}
        <box style={{ flexDirection: 'row', marginTop: -1 }}>
          <text style={{ fg: theme.borderColor }}>{'╰─── '}</text>
          <text style={{ fg: theme.muted }}>{model}</text>
          <text style={{ fg: theme.borderColor }}>{sep}</text>
          <text style={{ fg: theme.muted }}>{mode}</text>
          <text style={{ fg: theme.borderColor }}>{sep}</text>
          <text style={{ fg: hintOverride ? theme.foreground : theme.muted }}>{hintText}</text>
          <text style={{ fg: theme.borderColor }}>{' ' + '─'.repeat(dashesAfter) + '╯'}</text>
        </box>
      </box>
    )
  },
)
