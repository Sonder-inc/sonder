/**
 * School Mode Sidebar
 *
 * Displays the Cyber75 progression in the sidebar:
 * - Category view: Shows all 8 categories with progress
 * - Machine view: Shows machines in selected category
 * - Session view: Shows active box info and controls
 */

import { useState, useEffect } from 'react'
import { useTheme } from '../../hooks/use-theme'
import { useSchoolStore } from '../../state/school-store'
import { CATEGORIES, type Cyber75Box, type Cyber75Category } from '../../data/cyber75'

interface SchoolSidebarProps {
  width: number
}

export function SchoolSidebar({ width }: SchoolSidebarProps) {
  const theme = useTheme()
  const contentWidth = width - 4

  const {
    view,
    selectedCategoryIndex,
    selectedMachineIndex,
    expandedCategory,
    progress,
    activeBoxIp,
    vpnConnected,
    platformFilter,
    sidebarFocused,
    getVisibleMachines,
    getCategoryProgress,
    getTotalProgress,
    getActiveBox,
    getSessionDuration,
  } = useSchoolStore()

  const totalProgress = getTotalProgress()

  // Render based on current view
  if (view === 'session') {
    return (
      <SessionView
        width={width}
        contentWidth={contentWidth}
        theme={theme}
        activeBox={getActiveBox()}
        activeBoxIp={activeBoxIp}
        vpnConnected={vpnConnected}
        progress={progress}
        getSessionDuration={getSessionDuration}
      />
    )
  }

  if (view === 'machines' && expandedCategory) {
    return (
      <MachineListView
        width={width}
        contentWidth={contentWidth}
        theme={theme}
        expandedCategory={expandedCategory}
        machines={getVisibleMachines()}
        selectedIndex={selectedMachineIndex}
        progress={progress}
        focused={sidebarFocused}
        getCategoryProgress={getCategoryProgress}
      />
    )
  }

  return (
    <CategoryListView
      width={width}
      contentWidth={contentWidth}
      theme={theme}
      selectedIndex={selectedCategoryIndex}
      totalProgress={totalProgress}
      platformFilter={platformFilter}
      focused={sidebarFocused}
      getCategoryProgress={getCategoryProgress}
    />
  )
}

// ─── Category List View ───────────────────────────────────────────────────────

interface CategoryListViewProps {
  width: number
  contentWidth: number
  theme: ReturnType<typeof useTheme>
  selectedIndex: number
  totalProgress: { completed: number; total: number }
  platformFilter: 'all' | 'htb' | 'thm'
  focused: boolean
  getCategoryProgress: (category: Cyber75Category) => { completed: number; total: number }
}

function CategoryListView({
  width,
  contentWidth,
  theme,
  selectedIndex,
  totalProgress,
  platformFilter,
  focused,
  getCategoryProgress,
}: CategoryListViewProps) {
  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '…'
  }

  return (
    <box
      style={{
        width,
        borderStyle: 'single',
        borderColor: focused ? theme.accent : theme.borderColor,
        marginRight: 1,
        marginTop: 1,
        marginBottom: 1,
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <box
        style={{
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <text style={{ fg: theme.accent }}>CYBER 75</text>
        <text style={{ fg: theme.muted }}>
          {totalProgress.completed}/{totalProgress.total}
        </text>
      </box>

      {/* Divider */}
      <text style={{ fg: theme.borderColor }}>{'─'.repeat(width - 2)}</text>

      {/* Category list */}
      <box style={{ flexDirection: 'column', paddingLeft: 1, paddingRight: 1 }}>
        {CATEGORIES.map((cat, index) => {
          const isSelected = index === selectedIndex
          const catProgress = getCategoryProgress(cat.id)
          const isComplete = catProgress.completed === catProgress.total

          return (
            <box key={cat.id} style={{ flexDirection: 'row' }}>
              <text style={{ fg: isSelected && focused ? theme.accent : theme.muted }}>
                {isSelected && focused ? '▸ ' : '  '}
              </text>
              <text
                style={{
                  fg: isComplete
                    ? theme.success
                    : isSelected && focused
                      ? theme.foreground
                      : theme.muted,
                }}
              >
                {truncate(cat.shortName, contentWidth - 10)}
              </text>
              <text style={{ fg: theme.muted }}>
                {' '.repeat(Math.max(1, contentWidth - 10 - cat.shortName.length))}
                {catProgress.completed}/{catProgress.total}
              </text>
            </box>
          )
        })}
      </box>

      {/* Spacer */}
      <box style={{ flexGrow: 1 }} />

      {/* Divider */}
      <text style={{ fg: theme.borderColor }}>{'─'.repeat(width - 2)}</text>

      {/* Footer with controls */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>
          {platformFilter === 'all' ? '[A]ll' : platformFilter === 'htb' ? '[H]TB' : '[T]HM'}
        </text>
        <text style={{ fg: theme.muted }}>↑↓ nav → expand</text>
      </box>
    </box>
  )
}

// ─── Machine List View ────────────────────────────────────────────────────────

interface MachineListViewProps {
  width: number
  contentWidth: number
  theme: ReturnType<typeof useTheme>
  expandedCategory: Cyber75Category
  machines: Cyber75Box[]
  selectedIndex: number
  progress: Record<string, { user: boolean; root: boolean }>
  focused: boolean
  getCategoryProgress: (category: Cyber75Category) => { completed: number; total: number }
}

function MachineListView({
  width,
  contentWidth,
  theme,
  expandedCategory,
  machines,
  selectedIndex,
  progress,
  focused,
  getCategoryProgress,
}: MachineListViewProps) {
  const category = CATEGORIES.find((c) => c.id === expandedCategory)
  const catProgress = getCategoryProgress(expandedCategory)

  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '…'
  }

  const getDifficultyChar = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy':
        return 'E'
      case 'medium':
        return 'M'
      case 'hard':
        return 'H'
      case 'insane':
        return 'I'
      default:
        return '?'
    }
  }

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy':
        return theme.success
      case 'medium':
        return theme.warning
      case 'hard':
        return theme.error
      case 'insane':
        return '#dc2626'
      default:
        return theme.muted
    }
  }

  // Calculate visible window (max 10 items, centered on selection)
  const maxVisible = 10
  const halfWindow = Math.floor(maxVisible / 2)
  let startIndex = Math.max(0, selectedIndex - halfWindow)
  const endIndex = Math.min(machines.length, startIndex + maxVisible)
  if (endIndex - startIndex < maxVisible) {
    startIndex = Math.max(0, endIndex - maxVisible)
  }
  const visibleMachines = machines.slice(startIndex, endIndex)

  return (
    <box
      style={{
        width,
        borderStyle: 'single',
        borderColor: focused ? theme.accent : theme.borderColor,
        marginRight: 1,
        marginTop: 1,
        marginBottom: 1,
        flexDirection: 'column',
      }}
    >
      {/* Header with back button */}
      <box
        style={{
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <text>
          <span style={{ fg: theme.muted }}>◂ </span>
          <span style={{ fg: theme.accent }}>{category?.shortName || 'Machines'}</span>
        </text>
        <text style={{ fg: theme.muted }}>
          {catProgress.completed}/{catProgress.total}
        </text>
      </box>

      {/* Divider */}
      <text style={{ fg: theme.borderColor }}>{'─'.repeat(width - 2)}</text>

      {/* Machine list */}
      <box style={{ flexDirection: 'column', paddingLeft: 1, paddingRight: 1 }}>
        {/* Scroll up indicator */}
        {startIndex > 0 && <text style={{ fg: theme.muted }}>  ↑ more</text>}

        {visibleMachines.length === 0 ? (
          <text style={{ fg: theme.muted }}>No machines</text>
        ) : (
          visibleMachines.map((machine, visibleIndex) => {
            const actualIndex = startIndex + visibleIndex
            const isSelected = actualIndex === selectedIndex
            const p = progress[machine.id]
            const userOwned = p?.user || false
            const rootOwned = p?.root || false

            return (
              <box key={machine.id} style={{ flexDirection: 'row' }}>
                {/* Selection indicator */}
                <text style={{ fg: isSelected && focused ? theme.accent : theme.muted }}>
                  {isSelected && focused ? '▶' : ' '}
                </text>

                {/* Owned indicators */}
                <text style={{ fg: userOwned ? theme.success : theme.muted }}>
                  {userOwned ? '●' : '○'}
                </text>
                <text style={{ fg: rootOwned ? theme.success : theme.muted }}>
                  {rootOwned ? '●' : '○'}
                </text>

                {/* Name */}
                <text
                  style={{
                    fg: isSelected && focused ? theme.foreground : theme.muted,
                    marginLeft: 1,
                  }}
                >
                  {truncate(machine.name, contentWidth - 12)}
                </text>

                {/* Platform badge */}
                <text style={{ fg: theme.muted }}>
                  {' '}
                  <span style={{ fg: getDifficultyColor(machine.difficulty) }}>
                    [{getDifficultyChar(machine.difficulty)}]
                  </span>
                  <span style={{ fg: machine.platform === 'htb' ? '#9fef00' : '#22c55e' }}>
                    {machine.platform === 'htb' ? 'H' : 'T'}
                  </span>
                </text>
              </box>
            )
          })
        )}

        {/* Scroll down indicator */}
        {endIndex < machines.length && <text style={{ fg: theme.muted }}>  ↓ more</text>}
      </box>

      {/* Spacer */}
      <box style={{ flexGrow: 1 }} />

      {/* Divider */}
      <text style={{ fg: theme.borderColor }}>{'─'.repeat(width - 2)}</text>

      {/* Footer */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>Enter: spawn</text>
        <text style={{ fg: theme.muted }}>← back</text>
      </box>
    </box>
  )
}

// ─── Session View ─────────────────────────────────────────────────────────────

interface SessionViewProps {
  width: number
  contentWidth: number
  theme: ReturnType<typeof useTheme>
  activeBox: Cyber75Box | null
  activeBoxIp: string | null
  vpnConnected: boolean
  progress: Record<string, { user: boolean; root: boolean }>
  getSessionDuration: () => number
}

function SessionView({
  width,
  theme,
  activeBox,
  activeBoxIp,
  vpnConnected,
  progress,
  getSessionDuration,
}: SessionViewProps) {
  // Force re-render every second to update the timer
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!activeBox) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [activeBox])

  if (!activeBox) {
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
        }}
      >
        <text style={{ fg: theme.muted }}>No active session</text>
      </box>
    )
  }

  const p = progress[activeBox.id]
  const userOwned = p?.user || false
  const rootOwned = p?.root || false

  const duration = getSessionDuration()
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = duration % 60
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy':
        return theme.success
      case 'medium':
        return theme.warning
      case 'hard':
        return theme.error
      case 'insane':
        return '#dc2626'
      default:
        return theme.muted
    }
  }

  return (
    <box
      style={{
        width,
        borderStyle: 'single',
        borderColor: theme.success,
        marginRight: 1,
        marginTop: 1,
        marginBottom: 1,
        flexDirection: 'column',
      }}
    >
      {/* Header - Machine name */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: 'row', gap: 1 }}>
        <text style={{ fg: theme.success }}>●</text>
        <text style={{ fg: theme.accent }}>{activeBox.name}</text>
      </box>

      {/* Divider */}
      <text style={{ fg: theme.borderColor }}>{'─'.repeat(width - 2)}</text>

      {/* Machine info */}
      <box style={{ flexDirection: 'column', paddingLeft: 1, paddingRight: 1 }}>
        {/* IP */}
        <text style={{ fg: theme.foreground }}>{activeBoxIp || 'Getting IP...'}</text>

        {/* Difficulty and OS */}
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: getDifficultyColor(activeBox.difficulty) }}>
            {activeBox.difficulty}
          </text>
          <text style={{ fg: theme.muted }}>·</text>
          <text style={{ fg: theme.muted }}>{activeBox.os}</text>
        </box>
      </box>

      {/* Divider */}
      <text style={{ fg: theme.borderColor }}>{'─'.repeat(width - 2)}</text>

      {/* Flags section */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>Flags:</text>
        <box style={{ flexDirection: 'row', gap: 2 }}>
          <text style={{ fg: userOwned ? theme.success : theme.muted }}>
            {userOwned ? '●' : '○'} user
          </text>
          <text style={{ fg: rootOwned ? theme.success : theme.muted }}>
            {rootOwned ? '●' : '○'} root
          </text>
        </box>
      </box>

      {/* Divider */}
      <text style={{ fg: theme.borderColor }}>{'─'.repeat(width - 2)}</text>

      {/* Status section */}
      <box style={{ flexDirection: 'column', paddingLeft: 1, paddingRight: 1 }}>
        <box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <text style={{ fg: theme.muted }}>VPN:</text>
          <text style={{ fg: vpnConnected ? theme.success : theme.error }}>
            {vpnConnected ? '● connected' : '○ disconnected'}
          </text>
        </box>
        <box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <text style={{ fg: theme.muted }}>Time:</text>
          <text style={{ fg: theme.foreground }}>{timeStr}</text>
        </box>
      </box>

      {/* Spacer */}
      <box style={{ flexGrow: 1 }} />

      {/* Divider */}
      <text style={{ fg: theme.borderColor }}>{'─'.repeat(width - 2)}</text>

      {/* Commands */}
      <box style={{ paddingLeft: 1, paddingRight: 1, flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>/flag {'<flag>'}</text>
        <text style={{ fg: theme.muted }}>/hint</text>
        <text style={{ fg: theme.muted }}>/stop</text>
      </box>
    </box>
  )
}
