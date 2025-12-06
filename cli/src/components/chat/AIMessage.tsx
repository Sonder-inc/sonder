import { useState, useCallback } from 'react'
import { useTheme } from '../../hooks/use-theme'
import { ToolInvocation } from '../tool-invocation'
import { ThinkingIndicator } from '../thinking-indicator'
import { InterruptedIndicator } from './InterruptedIndicator'
import { FeedbackIndicator } from './FeedbackIndicator'
import { Markdown } from '../markdown'
import { copyToClipboard } from '../../utils/clipboard'
import type { ToolCall, FeedbackValue } from '../../types/chat'

interface AIMessageProps {
  messageId: string
  content: string
  isStreaming?: boolean
  isInterrupted?: boolean
  isThinking?: boolean
  thinkingContent?: string
  thinkingDurationMs?: number
  expandedThinkingId: string | null
  onToggleExpandThinking: (id: string) => void
  toolCalls: ToolCall[]
  expandedToolId: string | null
  onToggleExpandTool: (id: string) => void
  feedback?: FeedbackValue
  onFeedback: (messageId: string, value: FeedbackValue) => void
  isLastMessage: boolean
}

export const AIMessage = ({
  messageId,
  content,
  isStreaming,
  isInterrupted,
  isThinking,
  thinkingContent,
  thinkingDurationMs,
  expandedThinkingId,
  onToggleExpandThinking,
  toolCalls,
  expandedToolId,
  onToggleExpandTool,
  feedback,
  onFeedback,
  isLastMessage,
}: AIMessageProps) => {
  const theme = useTheme()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!content || isStreaming) return
    void copyToClipboard(content).then((success) => {
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    })
  }, [content, isStreaming])

  // Only show thinking indicator after streaming completes (for expandable "Thought for Xs")
  // During streaming, thinking is shown in StreamingStatus
  const showThinkingIndicator = !isStreaming && thinkingContent

  return (
    <>
      {/* Thinking indicator - only shows after streaming completes */}
      {showThinkingIndicator && (
        <ThinkingIndicator
          status="complete"
          durationMs={thinkingDurationMs ?? 0}
          content={thinkingContent}
          expanded={expandedThinkingId === messageId}
          onToggleExpand={() => onToggleExpandThinking(messageId)}
        />
      )}
      {/* AI message content with markdown - click to copy */}
      {content && (
        <box style={{ flexDirection: 'column' }} onMouseDown={handleCopy}>
          {copied && <text style={{ fg: theme.success }}>copied*</text>}
          {isStreaming ? (
            // While streaming, show plain text with cursor
            <text style={{ fg: theme.muted, wrapMode: 'word' }}>
              {content}{'▌'}
            </text>
          ) : (
            // When complete, render markdown
            <Markdown content={content} />
          )}
        </box>
      )}
      {/* Tool invocations */}
      {toolCalls.map((tool) => (
        <ToolInvocation
          key={tool.id}
          toolName={tool.toolName}
          params={tool.params}
          displayName={tool.displayName}
          displayInput={tool.displayInput}
          displayMiddle={tool.displayMiddle}
          displayColor={tool.displayColor}
          status={tool.status}
          summary={tool.summary}
          expanded={expandedToolId === tool.id}
          fullResult={tool.fullResult}
          onToggleExpand={() => onToggleExpandTool(tool.id)}
        />
      ))}
      {/* Interruption indicator */}
      {isInterrupted && <InterruptedIndicator />}
      {/* Feedback indicator - only show when complete and not streaming */}
      {!isStreaming && !isInterrupted && content && (
        <FeedbackIndicator
          messageId={messageId}
          feedback={feedback ?? null}
          onFeedback={onFeedback}
          isLastMessage={isLastMessage}
        />
      )}
    </>
  )
}
