import { UserMessage } from './UserMessage'
import { AIMessage } from './AIMessage'
import { InterruptedIndicator } from './InterruptedIndicator'
import type { ChatMessage, ToolCall } from '../../types/chat'

interface MessageListProps {
  messages: ChatMessage[]
  toolCalls: ToolCall[]
  expandedToolId: string | null
  onToggleExpandTool: (id: string) => void
}

export const MessageList = ({
  messages,
  toolCalls,
  expandedToolId,
  onToggleExpandTool,
}: MessageListProps) => {
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
            ) : (
              <AIMessage
                content={msg.content}
                isStreaming={msg.isStreaming}
                isInterrupted={msg.isInterrupted}
                toolCalls={messageToolCalls}
                expandedToolId={expandedToolId}
                onToggleExpandTool={onToggleExpandTool}
              />
            )}
          </box>
        )
      })}
    </>
  )
}
