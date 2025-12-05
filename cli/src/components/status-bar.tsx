import { useTheme } from '../hooks/use-theme'
import { ShimmerText } from './shimmer-text'

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
    if (!isConnected) {
      return 'Disconnected'
    }
    if (!isStreaming) {
      return 'Ready'
    }
    return null // Will render ShimmerText instead
  }

  const getStatusColor = () => {
    if (!isConnected) {
      return theme.error
    }
    return theme.muted
  }

  const statusText = getStatusText()

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
      {statusText ? (
        <text style={{ fg: getStatusColor() }}>{statusText}</text>
      ) : (
        <text>
          <ShimmerText text="Thinking..." primaryColor={theme.warning} />
        </text>
      )}
      <text style={{ fg: theme.muted }}>Sonder v0.1.0</text>
    </box>
  )
}
