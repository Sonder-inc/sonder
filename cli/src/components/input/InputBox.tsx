import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { BorderCharacters } from '@opentui/core'

import { MultilineInput, type MultilineInputHandle } from './MultilineInput'
import { Cursor } from '../cursor'
import { useTheme } from '../../hooks/use-theme'
import type { InputBoxProps } from './types'

const BORDER_CHARS: BorderCharacters = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
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
      model = 'sonder',
      mode = 'stealth',
      thinkingEnabled = true,
      onKeyIntercept,
      hintOverride,
      accentColor,
    },
    ref
  ) {
    const theme = useTheme()
    const isSchoolMode = mode === 'school'
    const borderFg = accentColor ?? (isSchoolMode ? theme.accent : theme.borderColor)
    const inputRef = useRef<MultilineInputHandle | null>(null)

    // Forward ref using useImperativeHandle
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }))

    // Calculate widths
    const innerWidth = width - 2 // minus left and right border chars

    // Bottom status bar content
    const hintText = hintOverride ?? '? for shortcuts'
    const sep = ' ─── '
    // Rendered: ╰─ (3) + model + sep(5) + mode + sep(5) + hintText + ' '(1) + ╯(1) = 15 + 2 adjustment
    const fixedChars = 13
    const dashesAfter = Math.max(0, innerWidth - fixedChars - model.length - mode.length - hintText.length)

    return (
      <box style={{ flexDirection: 'column', width }}>
        {/* Main input box with native borders */}
        <box
          style={{
            borderStyle: 'single',
            borderColor: borderFg,
            customBorderChars: BORDER_CHARS,
            borderBottom: false,
            paddingLeft: 1,
            paddingRight: 1,
            flexDirection: 'row',
            alignItems: 'flex-start',
          }}
        >
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
        </box>

        {/* Status bar overlaying the bottom border */}
        <box style={{ flexDirection: 'row', marginTop: -1 }}>
          <text style={{ fg: borderFg }}>{'╰─ '}</text>
          <text style={{ fg: thinkingEnabled ? theme.accent : theme.muted }}>{model}</text>
          <text style={{ fg: borderFg }}>{sep}</text>
          <text style={{ fg: isSchoolMode ? theme.accent : theme.muted }}>{mode}</text>
          <text style={{ fg: borderFg }}>{sep}</text>
          <text style={{ fg: hintOverride ? theme.foreground : theme.muted }}>{hintText}</text>
          <text style={{ fg: borderFg }}>{' ' + '─'.repeat(dashesAfter) + '╯'}</text>
        </box>
      </box>
    )
  }
)
