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

  // Build top border with title embedded: ┌─[1]Title─┐
  const titleText = `[${number}]${title}`
  const innerWidth = width - 2 // Account for corners
  const titleLen = titleText.length
  const leftDashes = Math.floor((innerWidth - titleLen) / 2)
  const rightDashes = innerWidth - titleLen - leftDashes
  const topBorder = `┌${'─'.repeat(leftDashes)}${titleText}${'─'.repeat(rightDashes)}┐`
  const bottomBorder = `└${'─'.repeat(innerWidth)}┘`

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow,
        width,
        height,
      }}
    >
      {/* Top border with title */}
      <text fg={borderColor}>
        {topBorder.slice(0, 1)}
        {'─'.repeat(leftDashes)}
        <span fg={numColor}>[{number}]</span>
        <span fg={titleColor}>{title}</span>
        {'─'.repeat(rightDashes)}
        {topBorder.slice(-1)}
      </text>

      {/* Content with side borders */}
      <box style={{ flexGrow: 1, flexDirection: 'column', height: height - 2, overflow: 'hidden' }}>
        {children}
      </box>

      {/* Bottom border */}
      <text fg={borderColor}>{bottomBorder}</text>
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
  const borderColor = isActive ? theme.accent : theme.borderColor

  return (
    <box style={{ flexDirection: 'row', width }}>
      <text fg={borderColor}>│</text>
      <box style={{ flexGrow: 1, flexDirection: 'row', paddingLeft: 1 }}>
        {children}
      </box>
      <text fg={borderColor}>│</text>
    </box>
  )
}
