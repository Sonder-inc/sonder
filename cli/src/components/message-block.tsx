import { useTheme } from '../hooks/use-theme'
import type { ChatMessage } from '../types/chat'

interface MessageBlockProps {
  message: ChatMessage
  availableWidth: number
}

export const MessageBlock = ({ message, availableWidth }: MessageBlockProps) => {
  const theme = useTheme()

  const getVariantStyles = () => {
    switch (message.variant) {
      case 'user':
        return {
          fg: theme.userMessageFg,
          prefix: '> ',
          prefixColor: theme.accent,
        }
      case 'ai':
        return {
          fg: theme.aiMessageFg,
          prefix: '',
          prefixColor: theme.success,
        }
      case 'system':
        return {
          fg: theme.muted,
          prefix: '[system] ',
          prefixColor: theme.muted,
        }
      case 'error':
        return {
          fg: theme.error,
          prefix: '[error] ',
          prefixColor: theme.error,
        }
      default:
        return {
          fg: theme.foreground,
          prefix: '',
          prefixColor: theme.foreground,
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <box
      style={{
        flexDirection: 'column',
        marginBottom: 1,
        width: '100%',
      }}
    >
      <text style={{ fg: styles.fg, wrapMode: 'word' }}>
        {styles.prefix && (
          <span fg={styles.prefixColor}>{styles.prefix}</span>
        )}
        {message.content}
        {message.isStreaming && <span fg={theme.muted}>{'_'}</span>}
      </text>
    </box>
  )
}
