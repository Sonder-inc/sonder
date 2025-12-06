import { UserMessage } from './UserMessage'
import { AIMessage } from './AIMessage'
import { SystemMessage } from './SystemMessage'
import { InterruptedIndicator } from './InterruptedIndicator'
import type { ChatMessage, ToolCall, FeedbackValue } from '../../types/chat'

interface MessageListProps {
  messages: ChatMessage[]
  toolCalls: ToolCall[]
  expandedToolId: string | null
  onToggleExpandTool: (id: string) => void
  expandedThinkingId: string | null
  onToggleExpandThinking: (id: string) => void
  onFeedback: (messageId: string, value: FeedbackValue) => void
}

export const MessageList = ({
  messages,
  toolCalls,
  expandedToolId,
  onToggleExpandTool,
  expandedThinkingId,
  onToggleExpandThinking,
  onFeedback,
}: MessageListProps) => {
  // Find the last AI message for keyboard feedback handling
  const lastAiMessageId = [...messages].reverse().find(m => m.variant === 'ai')?.id

  return (
    <>
      {messages.map((msg) => {
        // Get tool calls associated with this message
        const messageToolCalls = toolCalls.filter((t) => t.messageId === msg.id)

        // For interrupted messages with no content, render just the interruption indicator
        if (msg.isInterrupted && !msg.content && messageToolCalls.length === 0) {
          return <InterruptedIndicator key={msg.id} standalone />
        }

        return (
          <box key={msg.id} style={{ flexDirection: 'column', marginBottom: 1 }}>
            {msg.variant === 'user' ? (
              <UserMessage content={msg.content} />
            ) : msg.variant === 'system' ? (
              <SystemMessage content={msg.content} />
            ) : (
              <AIMessage
                messageId={msg.id}
                content={msg.content}
                isStreaming={msg.isStreaming}
                isInterrupted={msg.isInterrupted}
                isThinking={msg.isThinking}
                thinkingContent={msg.thinkingContent}
                thinkingDurationMs={msg.thinkingDurationMs}
                expandedThinkingId={expandedThinkingId}
                onToggleExpandThinking={onToggleExpandThinking}
                toolCalls={messageToolCalls}
                expandedToolId={expandedToolId}
                onToggleExpandTool={onToggleExpandTool}
                feedback={msg.feedback}
                onFeedback={onFeedback}
                isLastMessage={msg.id === lastAiMessageId}
              />
            )}
          </box>
        )
      })}
    </>
  )
}
