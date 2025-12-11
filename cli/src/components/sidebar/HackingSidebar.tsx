import { useState, useCallback } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { AgentsSection } from './AgentsSection'
import { ReconSection } from './ReconSection'
import { CredentialsSection } from './CredentialsSection'
import { SessionSection } from './SessionSection'
import { useHackingStore } from '../../state/hacking-store'

interface HackingSidebarProps {
  width: number
  showCommands?: boolean
  showContext?: boolean
}

export const HackingSidebar = ({ width, showCommands, showContext }: HackingSidebarProps) => {
  const [activeSection, setActiveSection] = useState<number | null>(null) // null = unfocused

  const {
    navigateFindingUp,
    navigateFindingDown,
    navigateCredentialUp,
    navigateCredentialDown,
    getSelectedFinding,
    getSelectedCredential,
    removeFinding,
    removeCredential,
    clearFindings,
    clearCredentials,
  } = useHackingStore()

  // Handle keyboard navigation
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
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

        // Section 2 (Recon) - navigate findings
        if (activeSection === 2) {
          if (key.name === 'up' || key.sequence === 'k') {
            navigateFindingUp()
          } else if (key.name === 'down' || key.sequence === 'j') {
            navigateFindingDown()
          } else if (key.sequence === 'd') {
            const selected = getSelectedFinding()
            if (selected) {
              removeFinding(selected.id)
            }
          } else if (key.sequence === 'c') {
            clearFindings()
          }
        }

        // Section 3 (Credentials) - navigate credentials
        if (activeSection === 3) {
          if (key.name === 'up' || key.sequence === 'k') {
            navigateCredentialUp()
          } else if (key.name === 'down' || key.sequence === 'j') {
            navigateCredentialDown()
          } else if (key.sequence === 'd') {
            const selected = getSelectedCredential()
            if (selected) {
              removeCredential(selected.id)
            }
          } else if (key.sequence === 'c') {
            clearCredentials()
          }
        }
      },
      [
        activeSection,
        navigateFindingUp,
        navigateFindingDown,
        navigateCredentialUp,
        navigateCredentialDown,
        getSelectedFinding,
        getSelectedCredential,
        removeFinding,
        removeCredential,
        clearFindings,
        clearCredentials,
      ]
    )
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
      <ReconSection isActive={activeSection === 2} width={width} />
      <CredentialsSection isActive={activeSection === 3} width={width} />
      <SessionSection isActive={activeSection === 4} width={width} />
    </box>
  )
}
