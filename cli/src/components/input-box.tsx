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

    // Calculate widths for manual border drawing
    const innerWidth = width - 2 // minus left and right border chars

    // Bottom border layout: ╰─── model ─── mode ─── hint ───╯
    const dashesBeforeModel = 3
    const separator = ' ─── '
    const hintText = hintOverride ?? '? for shortcuts'

    // Calculate remaining dashes for the end
    const usedWidth = dashesBeforeModel + 1 + model.length + separator.length + mode.length + separator.length + hintText.length + 1
    const dashesAfterHint = Math.max(0, innerWidth - usedWidth)

    return (
      <box style={{ flexDirection: 'column', width }}>
        {/* TOP BORDER */}
        <text style={{ fg: theme.borderColor }}>
          ╭{'─'.repeat(innerWidth)}╮
        </text>

        {/* MIDDLE: │ > input content │ */}
        <box style={{ flexDirection: 'row', width }}>
          <text style={{ fg: theme.borderColor }}>│ </text>
          <text style={{ fg: theme.muted }}>{'>'} </text>
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

        {/* BOTTOM BORDER with embedded status */}
        <box style={{ flexDirection: 'row' }}>
          <text style={{ fg: theme.borderColor }}>╰{'─'.repeat(dashesBeforeModel)} </text>
          <text style={{ fg: theme.muted }}>{model}</text>
          <text style={{ fg: theme.borderColor }}>{separator}</text>
          <text style={{ fg: theme.muted }}>{mode}</text>
          <text style={{ fg: theme.borderColor }}>{separator}</text>
          <text style={{ fg: hintOverride ? theme.foreground : theme.muted }}>{hintText}</text>
          <text style={{ fg: theme.borderColor }}> {'─'.repeat(dashesAfterHint)}╯</text>
        </box>
      </box>
    )
  },
)
