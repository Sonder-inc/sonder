import { searchCommands } from '../../utils/trie'
import { SelectableList } from '../ui/SelectableListItem'

interface CommandPanelProps {
  inputValue: string
  selectedIndex: number
}

export const CommandPanel = ({ inputValue, selectedIndex }: CommandPanelProps) => {
  const filteredCommands = searchCommands(inputValue)

  if (filteredCommands.length === 0) return null

  return (
    <box style={{ flexDirection: 'column', marginLeft: 1 }}>
      <SelectableList
        items={filteredCommands}
        selectedIndex={selectedIndex}
        getText={(cmd) => cmd.name}
        getDescription={(cmd) => cmd.description}
        getKey={(cmd) => cmd.name}
      />
    </box>
  )
}
