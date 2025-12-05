import { useTheme } from '../hooks/use-theme'

interface CursorProps {
  visible: boolean
}

export const Cursor = ({ visible }: CursorProps) => {
  const theme = useTheme()

  if (!visible) return null

  return (
    <text style={{ bg: theme.foreground, fg: theme.background }}>{' '}</text>
  )
}
