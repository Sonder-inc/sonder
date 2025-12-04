import { useTheme } from '../hooks/use-theme'

interface StatusBarProps {
  isStreaming?: boolean
  isConnected?: boolean
  statusMessage?: string
}

export const StatusBar = ({
  isStreaming = false,
  isConnected = true,
  statusMessage,
}: StatusBarProps) => {
  const theme = useTheme()

  const getStatusText = () => {
    if (statusMessage) {
      return statusMessage
    }
    if (isStreaming) {
      return 'Thinking...'
    }
    if (!isConnected) {
      return 'Disconnected'
    }
    return 'Ready'
  }

  const getStatusColor = () => {
    if (!isConnected) {
      return theme.error
    }
    if (isStreaming) {
      return theme.warning
    }
    return theme.muted
  }

  return (
    <box
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingLeft: 1,
        paddingRight: 1,
        height: 1,
      }}
    >
      <text style={{ fg: getStatusColor() }}>{getStatusText()}</text>
      <text style={{ fg: theme.muted }}>Sonder v0.1.0</text>
    </box>
  )
}
