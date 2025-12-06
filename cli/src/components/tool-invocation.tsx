import { useEffect, useState } from 'react'
import { TextAttributes } from '@opentui/core'
import { useTheme } from '../hooks/use-theme'

export interface ToolInvocationProps {
  toolName: string
  params: Record<string, unknown>
  // UI display customization
  displayName?: string // Override tool name
  displayInput?: string // Clean input display (e.g., file path, pattern)
  displayMiddle?: string // Content between tool line and summary
  displayColor?: 'default' | 'success' | 'error' // Indicator color
  status: 'executing' | 'complete' | 'error'
  summary?: string
  expanded?: boolean
  fullResult?: string
  onToggleExpand?: () => void
}

const formatParams = (params: Record<string, unknown>): string => {
  return Object.entries(params)
    .map(([key, value]) => {
      const strValue = typeof value === 'string' ? `"${value}"` : String(value)
      return `${key}: ${strValue}`
    })
    .join(', ')
}

const formatTokenCount = (charCount: number): string => {
  const tokens = Math.round(charCount / 4) // Rough estimate
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k tok` : `${tokens} tok`
}

export const ToolInvocation = ({
  toolName,
  params,
  displayName,
  displayInput,
  displayMiddle,
  displayColor,
  status,
  summary,
  expanded,
  fullResult,
}: ToolInvocationProps) => {
  const theme = useTheme()
  const [blinkOn, setBlinkOn] = useState(true)

  useEffect(() => {
    if (status !== 'executing') return
    const interval = setInterval(() => {
      setBlinkOn((prev) => !prev)
    }, 500) // Blink every 500ms
    return () => clearInterval(interval)
  }, [status])

  // Use displayInput if provided, otherwise fall back to formatted params
  const inputDisplay = displayInput ?? formatParams(params)

  // Truncate if too long
  const maxLen = 60
  const truncatedInput = inputDisplay.length > maxLen
    ? inputDisplay.slice(0, maxLen) + '...'
    : inputDisplay

  // Token count for expand hint
  const tokenHint = fullResult ? ` ${formatTokenCount(fullResult.length)}` : ''

  // Use displayName if provided, otherwise use toolName
  const nameToShow = displayName ?? toolName

  // Determine indicator color
  const getIndicatorColor = () => {
    if (status === 'executing') return theme.accent
    if (status === 'error') return theme.error
    // Use displayColor if provided, otherwise default to foreground (white)
    switch (displayColor) {
      case 'success': return theme.success
      case 'error': return theme.error
      default: return theme.foreground
    }
  }

  // Summary color: grey if no expandable content, otherwise normal
  const summaryColor = fullResult ? theme.foreground : theme.muted

  return (
    <box style={{ flexDirection: 'column', marginBottom: 1 }}>
      {/* Tool invocation line */}
      <text style={{ wrapMode: 'none' }}>
        <span fg={status === 'executing' && !blinkOn ? theme.background : getIndicatorColor()}>
          {'●'}{' '}
        </span>
        <span fg={theme.foreground}>{nameToShow}</span>
        <span fg={theme.muted}>({truncatedInput})</span>
      </text>

      {/* Middle content (if provided) */}
      {displayMiddle && (
        <text style={{ marginLeft: 2, fg: theme.muted }}>
          │ {displayMiddle}
        </text>
      )}

      {/* Result summary line */}
      {status !== 'executing' && summary && (
        <text style={{ marginLeft: 2, wrapMode: 'word' }}>
          <span fg={summaryColor}>⎿ {summary}</span>
          {fullResult && (
            <span fg={theme.muted} attributes={TextAttributes.DIM}>
              {' '}(⌃o{tokenHint})
            </span>
          )}
        </text>
      )}

      {/* Expanded result */}
      {expanded && fullResult && (
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
            {fullResult}
          </text>
        </box>
      )}
    </box>
  )
}
