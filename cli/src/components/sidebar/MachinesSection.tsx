import { useTheme } from '../../hooks/use-theme'
import { SidebarSection, SidebarRow } from './SidebarSection'
import { useSchoolStore } from '../../state/school-store'
import { CATEGORIES } from '../../data/cyber75'

interface MachinesSectionProps {
  isActive: boolean
  width: number
  maxVisible?: number
}

export const MachinesSection = ({ isActive, width, maxVisible = 6 }: MachinesSectionProps) => {
  const theme = useTheme()
  const {
    expandedCategory,
    selectedMachineIndex,
    progress,
    getVisibleMachines,
  } = useSchoolStore()

  const contentWidth = width - 4
  const machines = getVisibleMachines()
  const category = CATEGORIES.find((c) => c.id === expandedCategory)

  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '…'
  }

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'easy': return theme.success
      case 'medium': return theme.warning
      case 'hard': return theme.error
      case 'insane': return '#dc2626'
      default: return theme.muted
    }
  }

  const getPlatformChar = (platform: string): string => {
    switch (platform) {
      case 'htb': return 'H'
      case 'thm': return 'T'
      default: return '?'
    }
  }

  const getPlatformColor = (platform: string): string => {
    switch (platform) {
      case 'htb': return '#9fef00' // HTB green
      case 'thm': return '#22c55e' // THM green
      default: return theme.muted
    }
  }

  // Calculate visible window
  const halfWindow = Math.floor(maxVisible / 2)
  let startIndex = Math.max(0, selectedMachineIndex - halfWindow)
  const endIndex = Math.min(machines.length, startIndex + maxVisible)
  if (endIndex - startIndex < maxVisible) {
    startIndex = Math.max(0, endIndex - maxVisible)
  }
  const visibleMachines = machines.slice(startIndex, endIndex)

  // Title based on state
  const title = category?.shortName || 'Machines'

  return (
    <SidebarSection number={3} title={title} isActive={isActive} width={width} height={maxVisible + 2}>
      {!expandedCategory ? (
        <SidebarRow width={width} isActive={isActive}>
          <text fg={theme.muted}>Select a topic</text>
        </SidebarRow>
      ) : machines.length === 0 ? (
        <SidebarRow width={width} isActive={isActive}>
          <text fg={theme.muted}>No machines</text>
        </SidebarRow>
      ) : (
        visibleMachines.map((machine, visibleIndex) => {
          const actualIndex = startIndex + visibleIndex
          const isSelected = actualIndex === selectedMachineIndex
          const p = progress[machine.id]
          const userOwned = p?.user || false
          const rootOwned = p?.root || false

          return (
            <SidebarRow key={machine.id} width={width} isActive={isActive}>
              <text fg={isSelected && isActive ? theme.accent : theme.muted}>
                {isSelected && isActive ? '▶' : ' '}
              </text>
              <text fg={userOwned ? theme.success : theme.muted}>
                {userOwned ? '●' : '○'}
              </text>
              <text fg={rootOwned ? theme.success : theme.muted}>
                {rootOwned ? '●' : '○'}
              </text>
              <text fg={getDifficultyColor(machine.difficulty)}>
                {truncate(machine.name, contentWidth - 8)}
              </text>
              <text fg={getPlatformColor(machine.platform)}>
                [{getPlatformChar(machine.platform)}]
              </text>
            </SidebarRow>
          )
        })
      )}
    </SidebarSection>
  )
}
