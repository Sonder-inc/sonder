import { useTheme } from '../hooks/use-theme'

const SONDER_LOGO = [
  '▐▛███▜▌',
  '▜█████▛',
  ' ▘▘ ▝▝ ',
]

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
  modelInfo = 'max - black',
}: WelcomeBannerProps) => {
  const theme = useTheme()

  // Layout calculations
  const bannerWidth = width
  const innerWidth = bannerWidth - 2 // Minus left and right border chars

  // Left panel: ~40% | Right panel: ~60%
  const leftPanelWidth = Math.floor(innerWidth * 0.4)
  const rightPanelWidth = innerWidth - leftPanelWidth - 1 // -1 for divider

  // Title positioned on top border (left offset)
  const versionText = ` Sonder v${version} `
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
    buildRow(' ' + modelInfo, ''),                        // model info
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
        <text style={{ fg: theme.borderColor }}>╭{'─'.repeat(dashesBeforeTitle)}</text>
        <text style={{ fg: theme.accent }}>{versionText}</text>
        <text style={{ fg: theme.borderColor }}>{'─'.repeat(Math.max(0, dashesAfterTitle))}╮</text>
      </box>

      {/* CONTENT ROWS */}
      {rows.map((row, i) => (
        <box key={i} style={{ flexDirection: 'row' }}>
          <text style={{ fg: theme.borderColor }}>│</text>
          <text style={{ fg: i === 1 || i >= 7 ? theme.muted : (SONDER_LOGO.includes(row.left.trim()) ? theme.accent : theme.muted) }}>
            {row.left}
          </text>
          <text style={{ fg: theme.borderMuted }}>│</text>
          <text style={{ fg: row.right.includes('─') ? theme.borderMuted : (i === 1 || i === 4 ? theme.text : theme.muted) }}>
            {row.right}
          </text>
          <text style={{ fg: theme.borderColor }}>│</text>
        </box>
      ))}

      {/* BOTTOM BORDER */}
      <text style={{ fg: theme.borderColor }}>
        ╰{'─'.repeat(innerWidth)}╯
      </text>
    </box>
  )
}
