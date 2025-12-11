import { useState, useCallback } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { AgentsSection } from './AgentsSection'
import { TopicsSection } from './TopicsSection'
import { MachinesSection } from './MachinesSection'
import { MysterySection } from './MysterySection'
import { useSchoolStore } from '../../state/school-store'

interface SidebarProps {
  width: number
  isSchoolMode?: boolean
  showCommands?: boolean
  showContext?: boolean
}

export const Sidebar = ({ width, showCommands, showContext }: SidebarProps) => {
  const [activeSection, setActiveSection] = useState<number | null>(null) // null = unfocused

  const {
    navigateTopicUp,
    navigateTopicDown,
    navigateMachineUp,
    navigateMachineDown,
    selectCurrent,
    startSession,
    togglePlatformFilter,
  } = useSchoolStore()

  // Handle keyboard navigation
  useKeyboard(
    useCallback((key: KeyEvent) => {
      // Escape to unfocus sidebar
      if (key.name === 'escape') {
        setActiveSection(null)
        return
      }

      // Number keys to switch sections
      if (key.sequence && key.sequence.length === 1) {
        const num = parseInt(key.sequence, 10)
        if (num >= 1 && num <= 4) {
          setActiveSection(num)
          return
        }
      }

      // Section 2 (Topics) - navigate topics
      if (activeSection === 2) {
        if (key.name === 'up' || key.sequence === 'k') {
          navigateTopicUp()
        } else if (key.name === 'down' || key.sequence === 'j') {
          navigateTopicDown()
        } else if (key.sequence === 'p' || key.sequence === 'P') {
          togglePlatformFilter()
        }
      }

      // Section 3 (Machines) - navigate machines
      if (activeSection === 3) {
        if (key.name === 'up' || key.sequence === 'k') {
          navigateMachineUp()
        } else if (key.name === 'down' || key.sequence === 'j') {
          navigateMachineDown()
        } else if (key.name === 'return') {
          // Don't handle Enter if command/context panel is open
          if (showCommands || showContext) {
            return
          }

          const machine = selectCurrent()
          if (machine) {
            // TODO: Actually spawn the machine via API
            startSession(machine.id, '10.10.10.XX')
          }
        } else if (key.sequence === 'p' || key.sequence === 'P') {
          togglePlatformFilter()
        }
      }
    }, [activeSection, showCommands, showContext, navigateTopicUp, navigateTopicDown, navigateMachineUp, navigateMachineDown, selectCurrent, startSession, togglePlatformFilter])
  )

  return (
    <box
      style={{
        width,
        flexDirection: 'column',
        marginRight: 1,
        marginTop: 1,
        marginBottom: 1,
        flexGrow: 1,
      }}
    >
      <AgentsSection isActive={activeSection === 1} width={width} />
      <TopicsSection isActive={activeSection === 2} width={width} />
      <MachinesSection isActive={activeSection === 3} width={width} />
      <MysterySection isActive={activeSection === 4} width={width} />
    </box>
  )
}
