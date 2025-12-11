import { useTheme } from '../hooks/use-theme'
import { getUserTierInfo, getUserCredentials } from '../utils/auth'
import { useAuthStore } from '../state/auth-store'
import { useSchoolStore } from '../state/school-store'

const SONDER_LOGO = [
  '▐▛███▜▌',
  '▜█████▛',
  ' ▘▘ ▝▝ ',
]

interface WelcomeBannerProps {
  width: number
  version: string
  machineInfo: string
  modelInfo?: string
  mode?: string
  collapsed?: boolean
  smartShortcut?: string | null
}

export const WelcomeBanner = ({
  width,
  version,
  machineInfo,
  modelInfo,
  mode = 'stealth',
  collapsed = false,
  smartShortcut,
}: WelcomeBannerProps) => {
  const theme = useTheme()
  const isDevMode = useAuthStore((state) => state.isDevMode)
  const { progress, getTotalProgress } = useSchoolStore()

  // Get user info
  const user = getUserCredentials()
  const username = user?.name || 'unknown'

  // Get stats
  const totalProgress = getTotalProgress()
  const xp = totalProgress.completed * 100
  const owned = Object.values(progress).filter(p => p.root).length
  const streak = owned > 0 ? Math.min(owned, 7) : 0

  // Get tier info - shows 'unknown' if not logged in
  const tierInfo = getUserTierInfo()
  const displayTier = modelInfo ?? (tierInfo.isLoggedIn ? `${tierInfo.tier}` : 'unknown')
  const isSchoolMode = mode === 'school'
  const borderFg = isSchoolMode ? theme.accent : theme.borderColor

  // Collapsed thin banner - 5 lines tall with full logo
  if (collapsed) {
    return (
      <box style={{ flexDirection: 'row', marginLeft: 1, marginTop: 1, marginBottom: 1 }}>
        <box style={{ flexDirection: 'column' }}>
          <text> </text>
          <text style={{ fg: theme.accent }}>{SONDER_LOGO[0]}</text>
          <text style={{ fg: theme.accent }}>{SONDER_LOGO[1]}</text>
          <text style={{ fg: theme.accent }}>{SONDER_LOGO[2]}</text>
          <text> </text>
        </box>
        <box style={{ flexDirection: 'column', marginLeft: 1 }}>
          <text> </text>
          <text>
            <span fg={theme.foreground}>Sonder</span><span fg={theme.muted}> {version}</span>
            {isDevMode && (
              <span fg="#facc15"> [DEV]</span>
            )}
            {smartShortcut && (
              <>
                <span fg={theme.borderColor}> ─ </span>
                <span fg="#facc15">{'>|'}</span>
                <span fg={theme.muted}> {smartShortcut}</span>
              </>
            )}
          </text>
          <text>
            <span fg={theme.foreground}>{username}</span>
            <span fg={theme.muted}> </span>
            <span fg={theme.accent}>{xp}</span>
            <span fg={theme.muted}> </span>
            <span fg={theme.success}>{owned}</span>
            <span fg={theme.muted}> </span>
            <span fg={theme.warning}>{streak}</span>
          </text>
          <text style={{ fg: theme.muted }}>{machineInfo}</text>
          <text> </text>
        </box>
      </box>
    )
  }

  // Layout calculations
  const bannerWidth = width
  const innerWidth = bannerWidth - 2 // Minus left and right border chars

  // Left panel: ~40% | Right panel: ~60%
  const leftPanelWidth = Math.floor(innerWidth * 0.4)
  const rightPanelWidth = innerWidth - leftPanelWidth - 1 // -1 for divider

  // Title positioned on top border (left offset)
  const versionText = ` Sonder ${version}${isDevMode ? ' [DEV]' : ''} `
  const dashesBeforeTitle = 1
  const dashesAfterTitle = innerWidth - dashesBeforeTitle - versionText.length

  // Helper to center text in left panel
  const centerInPanel = (text: string, panelWidth: number) => {
    const padding = Math.max(0, Math.floor((panelWidth - text.length) / 2))
    const rightPad = Math.max(0, panelWidth - padding - text.length)
    return ' '.repeat(padding) + text + ' '.repeat(rightPad)
  }

  // Helper to left-align text in right panel
  const leftAlignInPanel = (text: string, panelWidth: number, leftPad = 1) => {
    const content = ' '.repeat(leftPad) + text
    const rightPad = Math.max(0, panelWidth - content.length)
    return content + ' '.repeat(rightPad)
  }

  // Build each row manually for perfect alignment
  // Row structure: │ [left content] │ [right content] │
  const buildRow = (leftContent: string, rightContent: string) => {
    const left = centerInPanel(leftContent, leftPanelWidth)
    const right = leftAlignInPanel(rightContent, rightPanelWidth)
    return { left, right }
  }

  // Define all rows
  const rows = [
    buildRow('', ''),                                    // empty top padding
    buildRow('Welcome back', 'Tips'),                    // greeting / tips header
    buildRow('', '/school to rank up'),                   // empty / tip text
    buildRow(SONDER_LOGO[0], '─'.repeat(rightPanelWidth - 2)), // logo line 1 / divider
    buildRow(SONDER_LOGO[1], 'Recent activity'),         // logo line 2 / activity header
    buildRow(SONDER_LOGO[2], 'No recent sessions'),      // logo line 3 / activity text
    buildRow('', ''),                                    // spacer
    buildRow(' ' + displayTier, ''),                       // tier info
    buildRow(machineInfo, ''),                           // machine info
    buildRow('', ''),                                    // bottom padding
  ]

  return (
    <box
      style={{
        flexDirection: 'column',
        marginTop: 1,
        marginBottom: 1,
        width: bannerWidth,
      }}
    >
      {/* TOP BORDER */}
      <box style={{ flexDirection: 'row' }}>
        <text style={{ fg: borderFg }}>╭{'─'.repeat(dashesBeforeTitle)}</text>
        <text style={{ fg: theme.accent }}>{versionText}</text>
        <text style={{ fg: borderFg }}>{'─'.repeat(Math.max(0, dashesAfterTitle))}╮</text>
      </box>

      {/* CONTENT ROWS */}
      {rows.map((row, i) => (
        <box key={i} style={{ flexDirection: 'row' }}>
          <text style={{ fg: borderFg }}>│</text>
          <text style={{ fg: i === 1 || i >= 7 ? theme.muted : (SONDER_LOGO.includes(row.left.trim()) ? theme.accent : theme.muted) }}>
            {row.left}
          </text>
          <text style={{ fg: theme.borderMuted }}>│</text>
          <text style={{ fg: row.right.includes('─') ? theme.borderMuted : (i === 1 || i === 4 ? theme.text : theme.muted) }}>
            {row.right}
          </text>
          <text style={{ fg: borderFg }}>│</text>
        </box>
      ))}

      {/* BOTTOM BORDER */}
      <text style={{ fg: borderFg }}>
        ╰{'─'.repeat(innerWidth)}╯
      </text>
    </box>
  )
}
