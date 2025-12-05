import { forwardRef, useRef } from 'react'

import { MultilineInput, type MultilineInputHandle } from './multiline-input'
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

    // Calculate widths for manual border drawing
    const innerWidth = width - 2 // minus left and right border chars
    const dashesBeforeText = 3
    const statusText = `${model} ─── ${mode} ─── ? for shortcuts`
    const dashesAfterText = Math.max(0, innerWidth - dashesBeforeText - statusText.length - 2)

    return (
      <box style={{ flexDirection: 'column', width }}>
        {/* Top border: ╭────────────────╮ */}
        <text style={{ fg: theme.borderColor }}>
          ╭{'─'.repeat(innerWidth)}╮
        </text>

        {/* Middle: │ > input content                    │ */}
        <box style={{ flexDirection: 'row', width }}>
          <text style={{ fg: theme.borderColor }}>│ </text>
          <text style={{ fg: theme.accent }}>{'>'} </text>
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
            />
          </box>
          <text style={{ fg: theme.borderColor }}> │</text>
        </box>

        {/* Bottom border with embedded status: ╰─── Sonder ─── stealth ─── ? for shortcuts ────╯ */}
        <text style={{ fg: theme.borderColor }}>
          ╰{'─'.repeat(dashesBeforeText)} <span fg={theme.muted}>{model}</span> ─── <span fg={theme.accent}>{mode}</span> ─── <span fg={theme.muted}>? for shortcuts</span> {'─'.repeat(dashesAfterText)}╯
        </text>
      </box>
    )
  },
)
