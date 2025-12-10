import { useTheme } from '../../hooks/use-theme'
import { SidebarSection, SidebarRow } from './SidebarSection'
import { useSchoolStore } from '../../state/school-store'

interface PlayerStatsSectionProps {
  isActive: boolean
  width: number
}

export const PlayerStatsSection = ({ isActive, width }: PlayerStatsSectionProps) => {
  const theme = useTheme()
  const { progress, getTotalProgress } = useSchoolStore()

  const totalProgress = getTotalProgress()
  const xp = totalProgress.completed * 100
  const owned = Object.values(progress).filter(p => p.root).length

  // TODO: Calculate actual streak from dates
  const streak = owned > 0 ? Math.min(owned, 7) : 0

  return (
    <SidebarSection number={1} title="Stats" isActive={isActive} width={width} height={4}>
      <SidebarRow width={width} isActive={isActive}>
        <text fg={theme.accent}>{xp}</text>
        <text fg={theme.muted}>xp </text>
        <text fg={theme.success}>{owned}</text>
        <text fg={theme.muted}>owned </text>
        <text fg={theme.warning}>{streak}</text>
        <text fg={theme.muted}>d</text>
      </SidebarRow>
    </SidebarSection>
  )
}
