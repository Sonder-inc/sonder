import { useEffect, useState } from 'react'
import { ShimmerText } from './shimmer-text'
import { useTheme } from '../hooks/use-theme'
import { useSubgoalStore } from '../state/subgoal-store'

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
  const { subgoals } = useSubgoalStore()
  const subgoalList = Object.values(subgoals)

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

  const hasSubgoals = subgoalList.length > 0
  const inProgressSubgoal = subgoalList.find(s => s.status === 'in_progress')
  // Use in-progress subgoal as flavor word
  const displayWord = inProgressSubgoal?.objective || flavorWord

  // Get checkbox and apply strikethrough for completed
  const getCheckbox = (status: 'pending' | 'in_progress' | 'completed' | 'blocked') => {
    switch (status) {
      case 'completed':
        return '☑'
      case 'in_progress':
        return '☐'
      case 'blocked':
        return '☒'
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
      {/* Flavor word or current subgoal */}
      <box style={{ flexDirection: 'row' }}>
        <text>
          <ShimmerText text={displayWord} primaryColor={theme.accent} interval={100} />
        </text>
        <text style={{ fg: theme.muted }}>
          {hasSubgoals
            ? ' (esc to interrupt)'
            : ` (esc to interrupt ${elapsed}s ${tokenCount > 0 ? '↓' : '↑'}${formatTokens(tokenCount)}toks)`
          }
        </text>
      </box>

      {/* Subgoals - max 8 */}
      {hasSubgoals && subgoalList.slice(0, 8).map((subgoal, index) => {
        const checkbox = getCheckbox(subgoal.status)
        const isFirst = index === 0
        const prefix = isFirst ? '└' : ' '
        const isCompleted = subgoal.status === 'completed'
        const isInProgress = subgoal.status === 'in_progress'
        const isBlocked = subgoal.status === 'blocked'
        const content = isCompleted ? strikethrough(subgoal.objective) : subgoal.objective
        const statusColor = isBlocked ? theme.error : (isCompleted ? theme.muted : (isInProgress ? theme.accent : theme.muted))

        return (
          <box key={subgoal.id} style={{ height: 1 }}>
            <text>
              <span fg={theme.muted}>{`  ${prefix} `}</span>
              <span fg={statusColor}>
                {checkbox}
              </span>
              <span fg={statusColor}>
                {` ${content}`}
              </span>
              {subgoal.logs.length > 0 && (
                <span fg={theme.muted}>
                  {` (${subgoal.logs.length} logs)`}
                </span>
              )}
            </text>
          </box>
        )
      })}
    </box>
  )
}
