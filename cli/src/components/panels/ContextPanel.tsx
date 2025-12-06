import { useTheme } from '../../hooks/use-theme'
import { ShimmerText } from '../shimmer-text'
import { searchContext } from '../../utils/trie'

interface ContextPanelProps {
  inputValue: string
  selectedIndex: number
}

export const ContextPanel = ({ inputValue, selectedIndex }: ContextPanelProps) => {
  const theme = useTheme()
  const filteredContext = searchContext(inputValue)

  if (filteredContext.length === 0) return null

  const clampedIndex = Math.min(selectedIndex, filteredContext.length - 1)

  return (
    <box style={{ flexDirection: 'column', marginLeft: 1 }}>
      {filteredContext.map((item, idx) => {
        const isSelected = idx === clampedIndex
        return (
          <text key={item.name} style={{ fg: theme.foreground }}>
            {isSelected ? (
              <ShimmerText text={item.label} primaryColor={theme.foreground} interval={80} />
            ) : item.label}
          </text>
        )
      })}
    </box>
  )
}
