import { useEffect, useState } from 'react'
import { TextAttributes } from '@opentui/core'
import { useTheme } from '../hooks/use-theme'

export interface ThinkingIndicatorProps {
  status: 'thinking' | 'complete'
  durationMs: number
  content?: string
  expanded?: boolean
  onToggleExpand?: () => void
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const ThinkingIndicator = ({
  status,
  durationMs,
  content,
  expanded,
  onToggleExpand,
}: ThinkingIndicatorProps) => {
  const theme = useTheme()
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  // Spinner animation while thinking
  useEffect(() => {
    if (status !== 'thinking') return
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 80)
    return () => clearInterval(interval)
  }, [status])

  // Elapsed time counter while thinking
  useEffect(() => {
    if (status !== 'thinking') return
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [status])

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  const displayDuration = status === 'thinking' ? `${elapsed}s` : formatDuration(durationMs)

  const handleClick = () => {
    if (status === 'complete' && content && onToggleExpand) {
      onToggleExpand()
    }
  }

  return (
    <box style={{ flexDirection: 'column', marginBottom: 1 }}>
      {/* Thinking status line - click to expand */}
      <box onMouseDown={handleClick}>
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>
            {status === 'thinking' ? SPINNER_FRAMES[spinnerFrame] : '∴'}{' '}
          </span>
          <span fg={theme.muted}>
            {status === 'thinking' ? 'Thinking' : 'Thought'} for {displayDuration}
          </span>
          {status === 'complete' && content && (
            <span fg={theme.muted} attributes={TextAttributes.DIM}>
              {' '}(click to {expanded ? 'hide' : 'show'})
            </span>
          )}
        </text>
      </box>

      {/* Expanded thinking content */}
      {expanded && content && (
        <box
          style={{
            marginLeft: 2,
            marginTop: 1,
            borderStyle: 'single',
            borderColor: theme.borderMuted,
            padding: 1,
          }}
        >
          <text style={{ fg: theme.muted, wrapMode: 'word' }}>
            {content}
          </text>
        </box>
      )}
    </box>
  )
}
