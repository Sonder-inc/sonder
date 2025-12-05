import { useEffect, useState } from 'react'
import { ShimmerText } from './shimmer-text'
import { useTheme } from '../hooks/use-theme'

interface StreamingStatusProps {
  flavorWord: string
  startTime: number
  tokenCount: number
}

export const StreamingStatus = ({ flavorWord, startTime, tokenCount }: StreamingStatusProps) => {
  const theme = useTheme()
  const [elapsed, setElapsed] = useState(0)

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  // Format token count (1.4k, 2.3k, etc)
  const formatTokens = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return String(count)
  }

  return (
    <box style={{ flexDirection: 'row' }}>
      <text>
        <ShimmerText text={flavorWord} primaryColor={theme.accent} interval={100} />
      </text>
      <text style={{ fg: theme.muted }}>
        {` (esc to interrupt - ${elapsed}s - ${formatTokens(tokenCount)} tokens)`}
      </text>
    </box>
  )
}
