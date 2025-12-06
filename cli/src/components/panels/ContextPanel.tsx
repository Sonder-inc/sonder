import { useTheme } from '../../hooks/use-theme'
import { ShimmerText } from '../shimmer-text'
import { searchContext } from '../../utils/trie'
import { WorktreePanel } from './WorktreePanel'

export type ContextFocusPhase = 'menu' | 'worktree'
export type WorktreeAction = 'switch' | 'fork'

interface ContextPanelProps {
  inputValue: string
  selectedIndex: number
  worktreeSelectedId: string | null
  focusPhase: ContextFocusPhase
  worktreeAction: WorktreeAction
}

export const ContextPanel = ({
  inputValue,
  selectedIndex,
  worktreeSelectedId,
  focusPhase,
}: ContextPanelProps) => {
  const theme = useTheme()
  const filteredContext = searchContext(inputValue)

  if (filteredContext.length === 0) return null

  const clampedIndex = Math.min(selectedIndex, filteredContext.length - 1)

  return (
    <box style={{ flexDirection: 'row', marginLeft: 1, gap: 3 }}>
      {/* Left: Context menu items */}
      <box style={{ flexDirection: 'column' }}>
        {filteredContext.map((item, idx) => {
          const isSelected = idx === clampedIndex && focusPhase === 'menu'
          return (
            <text key={item.name} style={{ fg: theme.foreground }}>
              {isSelected ? (
                <ShimmerText text={item.label} primaryColor={theme.foreground} interval={80} />
              ) : (
                item.label
              )}
            </text>
          )
        })}
      </box>

      {/* Right: Worktree panel */}
      <WorktreePanel selectedThreadId={worktreeSelectedId} isActive={focusPhase === 'worktree'} />
    </box>
  )
}
