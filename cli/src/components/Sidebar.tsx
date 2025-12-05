import { useTheme } from '../hooks/use-theme'

interface SidebarProps {
  width: number
  smartShortcut: string | null
}

export const Sidebar = ({ width, smartShortcut }: SidebarProps) => {
  const theme = useTheme()

  return (
    <box
      style={{
        width,
        borderStyle: 'single',
        borderColor: theme.borderColor,
        marginRight: 1,
        marginTop: 1,
        marginBottom: 1,
        padding: 1,
        flexDirection: 'column',
      }}
    >
      {/* Smart shortcut queue */}
      {smartShortcut && (
        <text>
          <span fg="#facc15">{'>|'}</span>
          <span fg={theme.muted}> {smartShortcut}</span>
        </text>
      )}

      {/* Plan section */}
      <text style={{ fg: theme.muted, marginTop: 1 }}>Plan</text>
    </box>
  )
}
