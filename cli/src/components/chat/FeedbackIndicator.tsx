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

type FeedbackState = 'idle' | 'hovered' | 'expanded' | 'submitted'

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

  const handleMouseOver = useCallback(() => {
    if (state === 'idle') {
      setState('hovered')
    }
  }, [state])

  const handleMouseOut = useCallback(() => {
    if (state === 'hovered') {
      setState('idle')
    }
  }, [state])

  const handleClick = useCallback(() => {
    if (state === 'hovered' || state === 'idle') {
      setState('expanded')
    }
  }, [state])

  // Handle keyboard input for feedback selection when expanded
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (!isLastMessage || state !== 'expanded') return

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
      <box
        style={{ flexDirection: 'row', justifyContent: 'flex-end' }}
        onMouseOut={() => setState('idle')}
      >
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

  // Idle/Hovered - use single element to prevent flicker
  const content = state === 'hovered' ? '[feedback?]' : '▼▲'

  return (
    <box
      style={{ flexDirection: 'row', justifyContent: 'flex-end' }}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onMouseDown={handleClick}
    >
      <text style={{ fg: theme.muted }}>{content}</text>
    </box>
  )
}
