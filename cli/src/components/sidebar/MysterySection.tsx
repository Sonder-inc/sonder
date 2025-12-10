import { useTheme } from '../../hooks/use-theme'
import { SidebarSection, SidebarRow } from './SidebarSection'
import { useSchoolStore } from '../../state/school-store'
import { CYBER75, CATEGORIES } from '../../data/cyber75'

interface MysterySectionProps {
  isActive: boolean
  width: number
}

export const MysterySection = ({ isActive, width }: MysterySectionProps) => {
  const theme = useTheme()
  const { progress } = useSchoolStore()

  // Calculate secrets unlocked
  const owned = Object.values(progress).filter(p => p.root).length
  const totalBoxes = CYBER75.length

  // Secret unlocks:
  // 1. First blood (first root)
  // 2. Category clear (any category 100%)
  // 3. Speedrunner (root in under 30 min)
  // 4. Collector (own 25 boxes)
  // 5. Master (own 50 boxes)
  // 6. Legend (own all 75)

  const hasFirstBlood = owned >= 1
  const hasSpeedrun = Object.values(progress).some(p => p.bestTime && p.bestTime < 1800)
  const hasCollector = owned >= 25
  const hasMaster = owned >= 50
  const hasLegend = owned >= totalBoxes

  // Check category clears
  const categoriesCleared = CATEGORIES.filter(cat => {
    const catBoxes = CYBER75.filter(b => b.category === cat.id)
    return catBoxes.every(b => progress[b.id]?.root)
  }).length

  const secretsFound = [
    hasFirstBlood,
    categoriesCleared > 0,
    hasSpeedrun,
    hasCollector,
    hasMaster,
    hasLegend,
  ].filter(Boolean).length

  const totalSecrets = 6

  // Mystery display
  const getSecretChar = (unlocked: boolean) => unlocked ? '◆' : '◇'

  return (
    <SidebarSection number={4} title="???" isActive={isActive} width={width} height={5}>
      <SidebarRow width={width} isActive={isActive}>
        <text fg={theme.muted}>{secretsFound}/{totalSecrets} </text>
        <text fg={hasFirstBlood ? theme.accent : theme.muted}>{getSecretChar(hasFirstBlood)}</text>
        <text fg={categoriesCleared > 0 ? theme.success : theme.muted}>{getSecretChar(categoriesCleared > 0)}</text>
        <text fg={hasSpeedrun ? theme.warning : theme.muted}>{getSecretChar(hasSpeedrun)}</text>
      </SidebarRow>
      <SidebarRow width={width} isActive={isActive}>
        <text fg={theme.muted}>      </text>
        <text fg={hasCollector ? theme.accent : theme.muted}>{getSecretChar(hasCollector)}</text>
        <text fg={hasMaster ? theme.success : theme.muted}>{getSecretChar(hasMaster)}</text>
        <text fg={hasLegend ? '#ffd700' : theme.muted}>{getSecretChar(hasLegend)}</text>
      </SidebarRow>
      <SidebarRow width={width} isActive={isActive}>
        <text fg={theme.muted}>
          {hasLegend ? '> LEGEND <' : owned === 0 ? '??????????': `${totalBoxes - owned} remain`}
        </text>
      </SidebarRow>
    </SidebarSection>
  )
}
