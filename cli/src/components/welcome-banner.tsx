import { useTheme } from '../hooks/use-theme'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'

// Sonder logo - cute crab placeholder
const SONDER_LOGO = `
    ▗ ▗   ▖ ▖

      ▘▘ ▝▝
`.trim()

interface WelcomeBannerProps {
  version?: string
  machineInfo?: string
  modelInfo?: string
}

export const WelcomeBanner = ({
  version = '0.1.08',
  machineInfo = 'home/hacks',
  modelInfo = 'DSv3.2 - pro',
}: WelcomeBannerProps) => {
  const theme = useTheme()
  const { terminalWidth } = useTerminalDimensions()

  // Calculate widths
  const bannerWidth = terminalWidth - 4 // Account for scrollbox padding
  const innerWidth = bannerWidth - 2 // Minus left and right border chars
  const sidebarWidth = Math.max(20, Math.min(35, Math.floor(bannerWidth * 0.35)))

  // Top border with embedded version
  const versionText = `Sonder v${version}`
  const dashesBeforeText = 3
  const dashesAfterText = Math.max(0, innerWidth - dashesBeforeText - versionText.length - 2)

  // Count actual lines (logo has multiple lines)
  const logoLines = SONDER_LOGO.split('\n').length
  const totalContentLines = logoLines + 4 // logo lines + padding/spacing/info

  // Generate vertical borders
  const leftBorders = Array(totalContentLines).fill('│')

  return (
    <box
      style={{
        flexDirection: 'column',
        marginTop: 1,
        marginBottom: 1,
        width: bannerWidth,
      }}
    >
      {/* Top border with embedded version: ╭─── Sonder v0.1.08 ──────────────╮ */}
      <text style={{ fg: theme.borderColor }}>
        ╭{'─'.repeat(dashesBeforeText)} <span fg={theme.accent}>Sonder</span> v{version} {'─'.repeat(dashesAfterText)}╮
      </text>

      {/* Content row with side borders */}
      <box style={{ flexDirection: 'row' }}>
        {/* Left border column */}
        <box style={{ flexDirection: 'column' }}>
          {leftBorders.map((_, i) => (
            <text key={`l${i}`} style={{ fg: theme.borderColor }}>│</text>
          ))}
        </box>

        {/* Left sidebar content */}
        <box
          style={{
            flexDirection: 'column',
            width: sidebarWidth - 2,
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 1,
            paddingBottom: 1,
          }}
        >
          <text style={{ fg: theme.accent }}>{SONDER_LOGO}</text>
          <text style={{ fg: theme.muted, marginTop: 1 }}>{modelInfo}</text>
          <text style={{ fg: theme.muted }}>{machineInfo}</text>
        </box>

        {/* Center divider */}
        <box style={{ flexDirection: 'column' }}>
          {leftBorders.map((_, i) => (
            <text key={`d${i}`} style={{ fg: theme.borderMuted }}>│</text>
          ))}
        </box>

        {/* Right content area */}
        <box
          style={{
            flexDirection: 'column',
            flexGrow: 1,
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 1,
            paddingBottom: 1,
          }}
        >
          <text style={{ fg: theme.foreground }}>Messages</text>
          <text style={{ fg: theme.borderMuted, marginTop: 1 }}>
            {'─'.repeat(Math.max(10, innerWidth - sidebarWidth - 4))}
          </text>
          <text style={{ fg: theme.muted, marginTop: 1 }}>Resume activities</text>
        </box>

        {/* Right border column */}
        <box style={{ flexDirection: 'column' }}>
          {leftBorders.map((_, i) => (
            <text key={`r${i}`} style={{ fg: theme.borderColor }}>│</text>
          ))}
        </box>
      </box>

      {/* Bottom border: ╰──────────────────────────────────╯ */}
      <text style={{ fg: theme.borderColor }}>
        ╰{'─'.repeat(innerWidth)}╯
      </text>
    </box>
  )
}
