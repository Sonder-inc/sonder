import { useState, useCallback, useEffect } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { useTheme } from '../../hooks/use-theme'
import type { FeedbackValue } from '../../types/chat'

interface FeedbackIndicatorProps {
  messageId: string
  feedback: FeedbackValue
  onFeedback: (messageId: string, value: FeedbackValue) => void
  isLastMessage: boolean
}

type FeedbackState = 'idle' | 'expanded' | 'submitted'

export const FeedbackIndicator = ({
  messageId,
  feedback,
  onFeedback,
  isLastMessage,
}: FeedbackIndicatorProps) => {
  const theme = useTheme()
  const [state, setState] = useState<FeedbackState>(feedback ? 'submitted' : 'idle')

  // Reset state when feedback prop changes (e.g., new message)
  useEffect(() => {
    setState(feedback ? 'submitted' : 'idle')
  }, [feedback, messageId])

  // Handle keyboard input for feedback (only for last message)
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (!isLastMessage || state === 'submitted') return

        // 'f' key toggles expanded state
        if (key.sequence === 'f' && state === 'idle') {
          setState('expanded')
          return
        }

        if (state !== 'expanded') return

        if (key.sequence === '1') {
          onFeedback(messageId, 'bad')
          setState('submitted')
        } else if (key.sequence === '2') {
          onFeedback(messageId, 'good')
          setState('submitted')
        } else if (key.sequence === '3') {
          onFeedback(messageId, 'great')
          setState('submitted')
        } else if (key.name === 'escape') {
          setState('idle')
        }
      },
      [state, isLastMessage, messageId, onFeedback]
    )
  )

  // Already submitted
  if (state === 'submitted' || feedback) {
    return (
      <box style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <text style={{ fg: theme.muted }}>[thanks]</text>
      </box>
    )
  }

  // Expanded - show options
  if (state === 'expanded') {
    return (
      <box style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <text style={{ fg: theme.muted }}>[</text>
        <text style={{ fg: theme.error }}>1:Bad</text>
        <text style={{ fg: theme.muted }}>,</text>
        <text style={{ fg: theme.warning }}>2:Good</text>
        <text style={{ fg: theme.muted }}>,</text>
        <text style={{ fg: theme.success }}>3:Great</text>
        <text style={{ fg: theme.muted }}>]</text>
      </box>
    )
  }

  // Idle state - show arrows (press 'f' to expand)
  return (
    <box style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
      <text style={{ fg: theme.muted }}>▼▲</text>
    </box>
  )
}
