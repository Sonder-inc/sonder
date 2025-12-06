/**
 * ThemedText - Semantic text components with theme colors
 *
 * Reduces repetitive theme.accent, theme.muted, etc. patterns
 */

import type { ReactNode } from 'react'
import { useTheme } from '../../hooks/use-theme'

interface ThemedTextProps {
  children: ReactNode
  /** Additional styles to merge */
  style?: Record<string, unknown>
}

/**
 * Primary accent-colored text
 */
export const AccentText = ({ children, style }: ThemedTextProps) => {
  const theme = useTheme()
  return <span fg={theme.accent} style={style}>{children}</span>
}

/**
 * Muted/dimmed text for secondary content
 */
export const MutedText = ({ children, style }: ThemedTextProps) => {
  const theme = useTheme()
  return <span fg={theme.muted} style={style}>{children}</span>
}

/**
 * Success/positive text (green)
 */
export const SuccessText = ({ children, style }: ThemedTextProps) => {
  const theme = useTheme()
  return <span fg={theme.success} style={style}>{children}</span>
}

/**
 * Error/negative text (red)
 */
export const ErrorText = ({ children, style }: ThemedTextProps) => {
  const theme = useTheme()
  return <span fg={theme.error} style={style}>{children}</span>
}

/**
 * Warning text (yellow/amber)
 */
export const WarningText = ({ children, style }: ThemedTextProps) => {
  const theme = useTheme()
  return <span fg={theme.warning} style={style}>{children}</span>
}

/**
 * Info text (cyan)
 */
export const InfoText = ({ children, style }: ThemedTextProps) => {
  const theme = useTheme()
  return <span fg={theme.info} style={style}>{children}</span>
}

/**
 * Normal foreground text
 */
export const ForegroundText = ({ children, style }: ThemedTextProps) => {
  const theme = useTheme()
  return <span fg={theme.foreground} style={style}>{children}</span>
}

/**
 * Panel header with title and optional description
 */
export const PanelHeader = ({
  title,
  description,
}: {
  title: string
  description?: string
}) => {
  const theme = useTheme()
  return (
    <box style={{ flexDirection: 'column' }}>
      <text style={{ fg: theme.accent }}>{title}</text>
      {description && (
        <text style={{ fg: theme.muted, marginTop: 1 }}>{description}</text>
      )}
    </box>
  )
}
