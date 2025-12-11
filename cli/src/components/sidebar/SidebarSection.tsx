import { useTheme } from '../../hooks/use-theme'

interface SidebarSectionProps {
  number: number
  title: string
  isActive?: boolean
  children?: React.ReactNode
  width?: number
  flexGrow?: number
  height?: number
}

export const SidebarSection = ({
  number,
  title,
  isActive = false,
  children,
  width = 20,
  flexGrow,
  height = 4,
}: SidebarSectionProps) => {
  const theme = useTheme()
  const borderColor = isActive ? theme.accent : theme.borderColor
  const titleColor = isActive ? theme.foreground : theme.muted
  const numColor = isActive ? theme.accent : theme.muted

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow,
        width,
        height,
        borderStyle: 'single',
        borderColor,
      }}
    >
      {/* Header with title */}
      <box
        style={{
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'row',
          justifyContent: 'center',
        }}
      >
        <text>
          <span fg={numColor}>[{number}]</span>
          <span fg={titleColor}>{title}</span>
        </text>
      </box>

      {/* Content area */}
      <box style={{ 
        flexGrow: 1, 
        flexDirection: 'column', 
        paddingLeft: 1, 
        paddingRight: 1,
        overflow: 'hidden' 
      }}>
        {children}
      </box>
    </box>
  )
}

// Row component for consistent styling with side borders
interface SidebarRowProps {
  children: React.ReactNode
  width: number
  isActive?: boolean
}

export const SidebarRow = ({ children, width, isActive = false }: SidebarRowProps) => {
  const theme = useTheme()

  return (
    <box style={{ 
      flexDirection: 'row', 
      width: width - 2, // Account for border padding
      flexGrow: 1 
    }}>
      {children}
    </box>
  )
}
