import { useEffect, useState } from 'react'
import { ShimmerText } from './shimmer-text'
import { useTheme } from '../hooks/use-theme'
import { usePlanStore } from '../state/plan-store'

interface StreamingStatusProps {
  flavorWord: string
  startTime: number
  tokenCount: number
  isThinking?: boolean
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const StreamingStatus = ({ flavorWord, startTime, tokenCount, isThinking }: StreamingStatusProps) => {
  const theme = useTheme()
  const [elapsed, setElapsed] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)

  // Spinner animation while thinking
  useEffect(() => {
    if (!isThinking) return
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 80)
    return () => clearInterval(interval)
  }, [isThinking])
  const { items } = usePlanStore()

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

  const hasPlan = items.length > 0
  const inProgressItem = items.find(i => i.status === 'in_progress')
  // Use in-progress item as flavor word when planning
  const displayWord = inProgressItem ? inProgressItem.content : flavorWord

  // Get checkbox and apply strikethrough for completed
  const getCheckbox = (status: 'pending' | 'in_progress' | 'completed') => {
    switch (status) {
      case 'completed':
        return '☑'
      case 'in_progress':
        return '☐'
      case 'pending':
        return '□'
    }
  }

  // Strikethrough text using unicode combining characters
  const strikethrough = (text: string) => {
    return text.split('').map(c => c + '\u0336').join('')
  }

  return (
    <box style={{ flexDirection: 'column' }}>
      {/* Thinking indicator - above flavor word */}
      {isThinking && (
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>
            {SPINNER_FRAMES[spinnerFrame]}{' '}
          </span>
          <span fg={theme.muted}>
            Thinking {elapsed}s
          </span>
        </text>
      )}
      {/* Flavor word or current plan item */}
      <box style={{ flexDirection: 'row' }}>
        <text>
          <ShimmerText text={displayWord} primaryColor={theme.accent} interval={100} />
        </text>
        <text style={{ fg: theme.muted }}>
          {hasPlan
            ? ' (esc to interrupt)'
            : ` (esc to interrupt ${elapsed}s ${tokenCount > 0 ? '↓' : '↑'}${formatTokens(tokenCount)}toks)`
          }
        </text>
      </box>

      {/* Plan items - max 8 */}
      {hasPlan && items.slice(0, 8).map((item, index) => {
        const checkbox = getCheckbox(item.status)
        const isFirst = index === 0
        const prefix = isFirst ? '└' : ' '
        const isCompleted = item.status === 'completed'
        const isInProgress = item.status === 'in_progress'
        const content = isCompleted ? strikethrough(item.content) : item.content

        return (
          <box key={item.id} style={{ height: 1 }}>
            <text>
              <span fg={theme.muted}>{`  ${prefix} `}</span>
              <span fg={isCompleted ? theme.muted : (isInProgress ? theme.foreground : theme.muted)}>
                {checkbox}
              </span>
              <span fg={isCompleted ? theme.muted : (isInProgress ? theme.foreground : theme.muted)}>
                {` ${content}`}
              </span>
            </text>
          </box>
        )
      })}
    </box>
  )
}
