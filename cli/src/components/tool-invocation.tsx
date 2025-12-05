import { useEffect, useState } from 'react'
import { TextAttributes } from '@opentui/core'
import { useTheme } from '../hooks/use-theme'

export interface ToolInvocationProps {
  toolName: string
  params: Record<string, unknown>
  status: 'executing' | 'complete' | 'error'
  summary?: string
  expanded?: boolean
  fullResult?: string
  onToggleExpand?: () => void
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const formatParams = (params: Record<string, unknown>): string => {
  return Object.entries(params)
    .map(([key, value]) => {
      const strValue = typeof value === 'string' ? `"${value}"` : String(value)
      return `${key}: ${strValue}`
    })
    .join(', ')
}

export const ToolInvocation = ({
  toolName,
  params,
  status,
  summary,
  expanded,
  fullResult,
}: ToolInvocationProps) => {
  const theme = useTheme()
  const [spinnerFrame, setSpinnerFrame] = useState(0)

  useEffect(() => {
    if (status !== 'executing') return
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 80)
    return () => clearInterval(interval)
  }, [status])

  const paramStr = formatParams(params)

  // Truncate params if too long
  const maxParamLen = 60
  const truncatedParams = paramStr.length > maxParamLen
    ? paramStr.slice(0, maxParamLen) + '...'
    : paramStr

  return (
    <box style={{ flexDirection: 'column', marginBottom: 1 }}>
      {/* Tool invocation line */}
      <text style={{ wrapMode: 'none' }}>
        <span fg={status === 'error' ? theme.error : theme.accent}>
          {status === 'executing' ? SPINNER_FRAMES[spinnerFrame] : '⏺'}{' '}
        </span>
        <span fg={theme.foreground}>{toolName}</span>
        <span fg={theme.muted}>({truncatedParams})</span>
      </text>

      {/* Result summary line */}
      {status !== 'executing' && summary && (
        <box style={{ flexDirection: 'row', marginLeft: 2 }}>
          <text style={{ fg: theme.muted }}>
            ⎿ {summary}
          </text>
          {fullResult && (
            <text>
              <span fg={theme.muted} attributes={TextAttributes.DIM}>
                {' '}(ctrl+o to {expanded ? 'collapse' : 'expand'})
              </span>
            </text>
          )}
        </box>
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
