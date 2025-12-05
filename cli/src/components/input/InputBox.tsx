import { forwardRef, useRef } from 'react'
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
      model = 'Sonder',
      mode = 'stealth',
      onKeyIntercept,
      hintOverride,
    },
    ref
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

    // Bottom status bar content
    const hintText = hintOverride ?? '? for shortcuts'
    const sep = ' ─── '
    const statusContent = `─── ${model}${sep}${mode}${sep}${hintText} `
    const dashesAfter = Math.max(0, innerWidth - statusContent.length)

    return (
      <box style={{ flexDirection: 'column', width }}>
        {/* Main input box with native borders */}
        <box
          style={{
            borderStyle: 'single',
            borderColor: theme.borderColor,
            customBorderChars: BORDER_CHARS,
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
  }
)
