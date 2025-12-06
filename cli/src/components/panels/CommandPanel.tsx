import { useTheme } from '../../hooks/use-theme'
import { ShimmerText } from '../shimmer-text'
import { searchCommands } from '../../utils/trie'

interface CommandPanelProps {
  inputValue: string
  selectedIndex: number
}

export const CommandPanel = ({ inputValue, selectedIndex }: CommandPanelProps) => {
  const theme = useTheme()
  const filteredCommands = searchCommands(inputValue)

  if (filteredCommands.length === 0) return null

  const clampedIndex = Math.min(selectedIndex, filteredCommands.length - 1)

  return (
    <box style={{ flexDirection: 'column', marginLeft: 1 }}>
      {filteredCommands.map((cmd, idx) => {
        const isSelected = idx === clampedIndex
        return (
          <box key={cmd.name} style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.slashCommandFg }}>
              {isSelected ? (
                <ShimmerText
                  text={cmd.name}
                  primaryColor={theme.slashCommandFg}
                  interval={80}
                />
              ) : (
                cmd.name
              )}
            </text>
            <text style={{ fg: isSelected ? theme.accent : theme.muted }}> {cmd.description}</text>
          </box>
        )
      })}
    </box>
  )
}
