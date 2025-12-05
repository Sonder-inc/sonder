import { useTheme } from '../../hooks/use-theme'
import { ToolInvocation } from '../tool-invocation'
import { InterruptedIndicator } from './InterruptedIndicator'
import { Markdown } from '../markdown'
import type { ToolCall } from '../../types/chat'

interface AIMessageProps {
  content: string
  isStreaming?: boolean
  isInterrupted?: boolean
  toolCalls: ToolCall[]
  expandedToolId: string | null
  onToggleExpandTool: (id: string) => void
}

export const AIMessage = ({
  content,
  isStreaming,
  isInterrupted,
  toolCalls,
  expandedToolId,
  onToggleExpandTool,
}: AIMessageProps) => {
  const theme = useTheme()

  return (
    <>
      {/* AI message content with markdown */}
      {content && (
        <box style={{ flexDirection: 'column' }}>
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
          status={tool.status}
          summary={tool.summary}
          expanded={expandedToolId === tool.id}
          fullResult={tool.fullResult}
          onToggleExpand={() => onToggleExpandTool(tool.id)}
        />
      ))}
      {/* Interruption indicator */}
      {isInterrupted && <InterruptedIndicator />}
    </>
  )
}
