import { useTheme } from '../hooks/use-theme'

const SONDER_LOGO = `▐▛███▜▌
▜█████▛
 ▘▘ ▝▝  `

interface WelcomeBannerProps {
  width: number
  version?: string
  machineInfo?: string
  modelInfo?: string
}

export const WelcomeBanner = ({
  width,
  version = '0.1.08',
  machineInfo = 'home/hacks',
  modelInfo = 'DSv3.2 - pro',
}: WelcomeBannerProps) => {
  const theme = useTheme()

  // Calculate widths - use provided width to match input bar
  const bannerWidth = width
  const innerWidth = bannerWidth - 2 // Minus left and right border chars
  const sidebarWidth = Math.max(20, Math.min(35, Math.floor(bannerWidth * 0.35)))

  // Top border with version aligned to sidebar center
  const versionText = `Sonder v${version}`
  const dashesBeforeText = Math.floor((sidebarWidth - versionText.length) / 2)
  const dashesAfterText = innerWidth - dashesBeforeText - versionText.length

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
      {/* Top border with centered version */}
      <text style={{ fg: theme.borderColor }}>
        ╭{'─'.repeat(dashesBeforeText)}Sonder v{version}{'─'.repeat(dashesAfterText)}╮
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
            paddingTop: 1,
            paddingBottom: 1,
            alignItems: 'center',
          }}
        >
          <text style={{ fg: theme.muted }}>{SONDER_LOGO}</text>
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
          <text style={{ fg: theme.muted }}>Messages</text>
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
