import { useEffect, useState } from 'react'
import { ShimmerText } from './shimmer-text'
import { useTheme } from '../hooks/use-theme'

interface StreamingStatusProps {
  flavorWord: string
  startTime: number
  tokenCount: number
}

// Braille spinner frames
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const StreamingStatus = ({ flavorWord, startTime, tokenCount }: StreamingStatusProps) => {
  const theme = useTheme()
  const [elapsed, setElapsed] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  // Animate spinner
  useEffect(() => {
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 150)
    return () => clearInterval(interval)
  }, [])

  // Format token count (1.4k, 2.3k, etc)
  const formatTokens = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return String(count)
  }

  return (
    <box style={{ flexDirection: 'row' }}>
      <text style={{ fg: theme.accent }}>{SPINNER_FRAMES[spinnerFrame]} </text>
      <text>
        <ShimmerText text={flavorWord} primaryColor={theme.accent} interval={100} />
      </text>
      <text style={{ fg: theme.muted }}>
        {` (esc to interrupt - ${elapsed}s - ${formatTokens(tokenCount)} tokens)`}
      </text>
    </box>
  )
}
