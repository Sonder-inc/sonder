import { TextAttributes } from '@opentui/core'
import { useTheme } from '../../hooks/use-theme'
import { ToolInvocation } from '../tool-invocation'
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
  const theme = useTheme()

  return (
    <>
      {messages.map((msg) => {
        // Get tool calls associated with this message
        const messageToolCalls = toolCalls.filter((t) => t.messageId === msg.id)

        // For interrupted messages with no content, render just the interruption indicator
        if (msg.isInterrupted && !msg.content && messageToolCalls.length === 0) {
          return (
            <box key={msg.id} style={{ flexDirection: 'row', marginTop: -1, marginBottom: 1 }}>
              <text style={{ fg: theme.error }}>⎿  Interrupted</text>
              <text style={{ fg: theme.muted }}> · What should Sonder do instead?</text>
            </box>
          )
        }

        return (
          <box key={msg.id} style={{ flexDirection: 'column', marginBottom: 1 }}>
            {msg.variant === 'user' ? (
              <text style={{ wrapMode: 'word' }}>
                <span fg="#ffffff" bg="#3f3f46" attributes={TextAttributes.BOLD}>
                  {' '}{msg.content}{' '}
                </span>
              </text>
            ) : (
              <>
                {/* AI message content (thinking + answer) */}
                {msg.content && (
                  <text style={{ fg: theme.muted, wrapMode: 'word' }}>
                    {msg.content}
                    {msg.isStreaming && msg.content ? '▌' : ''}
                  </text>
                )}
                {/* Tool invocations for this AI message */}
                {messageToolCalls.map((tool) => (
                  <ToolInvocation
                    key={tool.id}
                    toolName={tool.toolName}
                    params={tool.params}
                    status={tool.status}
                    summary={tool.summary}
                    expanded={expandedToolId === tool.id}
                    fullResult={tool.fullResult}
                    onToggleExpand={() => onToggleExpandTool(tool.id)}
                  />
                ))}
                {/* Interruption indicator */}
                {msg.isInterrupted && (
                  <box style={{ flexDirection: 'row' }}>
                    <text style={{ fg: theme.error }}>⎿  Interrupted</text>
                    <text style={{ fg: theme.muted }}> · What should Sonder do instead?</text>
                  </box>
                )}
              </>
            )}
          </box>
        )
      })}
    </>
  )
}
