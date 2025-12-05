import { useTheme } from '../../hooks/use-theme'

interface InterruptedIndicatorProps {
  /** Render as standalone (for empty interrupted messages) */
  standalone?: boolean
}

export const InterruptedIndicator = ({ standalone = false }: InterruptedIndicatorProps) => {
  const theme = useTheme()

  if (standalone) {
    return (
      <box style={{ marginTop: -1, marginBottom: 1 }}>
        <text>
          <span style={{ fg: theme.error }}>⎿  Interrupted</span>
          <span style={{ fg: theme.muted }}> · What should Sonder do instead?</span>
        </text>
      </box>
    )
  }

  return (
    <text>
      <span style={{ fg: theme.error }}>⎿  Interrupted</span>
      <span style={{ fg: theme.muted }}> · What should Sonder do instead?</span>
    </text>
  )
}
