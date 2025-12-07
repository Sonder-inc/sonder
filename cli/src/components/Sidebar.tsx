import { useTheme } from '../hooks/use-theme'
import { SchoolSidebar } from './school'

interface SidebarProps {
  width: number
  smartShortcut: string | null
  isSchoolMode?: boolean
}

export const Sidebar = ({ width, smartShortcut, isSchoolMode }: SidebarProps) => {
  const theme = useTheme()
  const contentWidth = width - 4

  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '…'
  }

  // Render school sidebar when in school mode
  if (isSchoolMode) {
    return <SchoolSidebar width={width} />
  }

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
        <box style={{ height: 1 }}>
          <text>
            <span fg="#facc15">{'>|'}</span>
            <span fg={theme.muted}> {truncate(smartShortcut, contentWidth - 3)}</span>
          </text>
        </box>
      )}

      {/* Placeholder for future sidebar content */}
      {!smartShortcut && (
        <text style={{ fg: theme.muted }}>Sidebar</text>
      )}
    </box>
  )
}
