import { useTheme } from '../../hooks/use-theme'
import { SidebarSection, SidebarRow } from './SidebarSection'
import { useSchoolStore } from '../../state/school-store'
import { CATEGORIES } from '../../data/cyber75'

interface TopicsSectionProps {
  isActive: boolean
  width: number
}

export const TopicsSection = ({ isActive, width }: TopicsSectionProps) => {
  const theme = useTheme()
  const {
    selectedCategoryIndex,
    expandedCategory,
    getCategoryProgress,
  } = useSchoolStore()

  const contentWidth = width - 4 // Account for borders and padding

  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '…'
  }

  const { getTotalProgress } = useSchoolStore()
  const totalProgress = getTotalProgress()
  const allComplete = totalProgress.completed === totalProgress.total

  return (
    <SidebarSection
      number={2}
      title="Topics"
      isActive={isActive}
      width={width}
      height={11}
    >
      {/* "all" option at index 0 */}
      <SidebarRow width={width} isActive={isActive}>
        <text fg={selectedCategoryIndex === 0 && isActive ? theme.accent : theme.muted}>
          {expandedCategory === 'all' ? '▼' : selectedCategoryIndex === 0 && isActive ? '▸' : ' '}
        </text>
        <text
          fg={
            allComplete
              ? theme.success
              : selectedCategoryIndex === 0 && isActive
                ? theme.foreground
                : theme.muted
          }
        >
          all
        </text>
      </SidebarRow>

      {/* Categories at index 1+ */}
      {CATEGORIES.map((cat, index) => {
        const actualIndex = index + 1
        const isSelected = actualIndex === selectedCategoryIndex
        const isExpanded = expandedCategory === cat.id
        const catProgress = getCategoryProgress(cat.id)
        const isComplete = catProgress.completed === catProgress.total

        return (
          <SidebarRow key={cat.id} width={width} isActive={isActive}>
            <text fg={isSelected && isActive ? theme.accent : theme.muted}>
              {isExpanded ? '▼' : isSelected && isActive ? '▸' : ' '}
            </text>
            <text
              fg={
                isComplete
                  ? theme.success
                  : isSelected && isActive
                    ? theme.foreground
                    : theme.muted
              }
            >
              {truncate(cat.shortName, contentWidth - 2)}
            </text>
          </SidebarRow>
        )
      })}
    </SidebarSection>
  )
}
