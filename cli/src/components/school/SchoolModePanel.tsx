/**
 * School Mode Panel
 *
 * Shows the current school mode state and provides UI for:
 * - Platform selection
 * - Machine selection
 * - Current target info
 */

import { useEffect, useState } from 'react'
import { useTheme } from '../../hooks/use-theme'
import { platformManager } from '../../services/platform'
import type { Machine } from '../../types/platform'
import type { SchoolModeState } from '../../hooks/use-school-mode'

interface SchoolModePanelProps {
  state: SchoolModeState
  onSelectPlatform: (platform: 'htb' | 'thm') => void
  onSelectMachine: (machine: Machine) => void
  onCancel: () => void
}

export const SchoolModePanel = ({
  state,
  onSelectPlatform,
  onSelectMachine,
  onCancel,
}: SchoolModePanelProps) => {
  const theme = useTheme()
  const [machines, setMachines] = useState<Machine[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  // Load machines when in selection phase
  useEffect(() => {
    if (state.phase === 'machine_select' && state.platform) {
      setLoading(true)
      platformManager
        .getPlatform(state.platform)
        .listMachines({ retired: false })
        .then(setMachines)
        .finally(() => setLoading(false))
    }
  }, [state.phase, state.platform])

  // ─── Auth Prompt ─────────────────────────────────────────────────────────────

  if (state.phase === 'auth_prompt') {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
        <text style={{ fg: theme.accent }}>Choose a platform to connect</text>
        <text style={{ fg: theme.muted, marginTop: 1 }}>
          sonder will open your browser to authenticate
        </text>

        <box style={{ flexDirection: 'row', marginTop: 1, gap: 2 }}>
          <box
            style={{
              borderStyle: 'single',
              borderColor: theme.accent,
              paddingLeft: 2,
              paddingRight: 2,
            }}
          >
            <text style={{ fg: theme.foreground }}>[H] HackTheBox</text>
          </box>
          <box
            style={{
              borderStyle: 'single',
              borderColor: '#22c55e',
              paddingLeft: 2,
              paddingRight: 2,
            }}
          >
            <text style={{ fg: theme.foreground }}>[T] TryHackMe</text>
          </box>
        </box>

        <text style={{ fg: theme.muted, marginTop: 1 }}>
          Press H or T to select, ESC to cancel
        </text>
      </box>
    )
  }

  // ─── Authenticating ──────────────────────────────────────────────────────────

  if (state.phase === 'authenticating') {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
        <text style={{ fg: theme.accent }}>
          Authenticating with {state.platform?.toUpperCase()}...
        </text>
        <text style={{ fg: theme.muted, marginTop: 1 }}>
          Complete the login in your browser
        </text>
      </box>
    )
  }

  // ─── VPN Connecting ──────────────────────────────────────────────────────────

  if (state.phase === 'vpn_connecting') {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
        <text style={{ fg: theme.accent }}>Connecting to VPN...</text>
        <text style={{ fg: theme.muted, marginTop: 1 }}>
          This may require sudo password
        </text>
      </box>
    )
  }

  // ─── Machine Selection ───────────────────────────────────────────────────────

  if (state.phase === 'machine_select') {
    if (loading) {
      return (
        <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
          <text style={{ fg: theme.accent }}>Loading machines...</text>
        </box>
      )
    }

    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
        <text style={{ fg: theme.accent }}>
          Select a machine ({state.platform?.toUpperCase()})
        </text>

        <box style={{ flexDirection: 'column', marginTop: 1, maxHeight: 10 }}>
          {machines.slice(0, 8).map((m, i) => (
            <box key={m.id} style={{ flexDirection: 'row' }}>
              <text style={{ fg: i === selectedIndex ? theme.accent : theme.muted }}>
                {i === selectedIndex ? '▶ ' : '  '}
              </text>
              <text style={{ fg: i === selectedIndex ? theme.foreground : theme.muted }}>
                {m.name}
              </text>
              <text style={{ fg: getDifficultyColor(m.difficulty, theme) }}>
                {' '}[{m.difficulty}]
              </text>
              <text style={{ fg: theme.muted }}> {m.os}</text>
              {m.userOwned && <text style={{ fg: theme.success }}> ✓user</text>}
              {m.rootOwned && <text style={{ fg: theme.success }}> ✓root</text>}
            </box>
          ))}
        </box>

        <text style={{ fg: theme.muted, marginTop: 1 }}>
          ↑↓ navigate | Enter select | ESC cancel
        </text>
      </box>
    )
  }

  // ─── Spawning ────────────────────────────────────────────────────────────────

  if (state.phase === 'spawning') {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
        <text style={{ fg: theme.accent }}>
          Spawning {state.machine?.name}...
        </text>
        <text style={{ fg: theme.muted, marginTop: 1 }}>
          This usually takes 30-60 seconds
        </text>
      </box>
    )
  }

  // ─── Error ───────────────────────────────────────────────────────────────────

  if (state.phase === 'error') {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
        <text style={{ fg: theme.error }}>Error</text>
        <text style={{ fg: theme.error }}>{state.error}</text>
        <text style={{ fg: theme.muted, marginTop: 1 }}>
          Press any key to dismiss
        </text>
      </box>
    )
  }

  // ─── Hacking (Active Session) ────────────────────────────────────────────────

  if (state.phase === 'hacking' && state.machine) {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1 }}>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: theme.success }}>●</text>
          <text style={{ fg: theme.accent }}>{state.machine.name}</text>
          <text style={{ fg: theme.muted }}>|</text>
          <text style={{ fg: theme.foreground }}>{state.machine.ip}</text>
          <text style={{ fg: theme.muted }}>|</text>
          <text style={{ fg: getDifficultyColor(state.machine.difficulty, theme) }}>
            {state.machine.difficulty}
          </text>
        </box>

        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text style={{ fg: state.machine.userOwned ? theme.success : theme.muted }}>
            {state.machine.userOwned ? '✓' : '○'} user
          </text>
          <text style={{ fg: state.machine.rootOwned ? theme.success : theme.muted }}>
            {state.machine.rootOwned ? '✓' : '○'} root
          </text>
          <text style={{ fg: theme.muted }}>|</text>
          <text style={{ fg: state.vpnConnected ? theme.success : theme.error }}>
            vpn: {state.vpnConnected ? 'connected' : 'disconnected'}
          </text>
        </box>
      </box>
    )
  }

  return null
}

function getDifficultyColor(difficulty: string, theme: any): string {
  switch (difficulty) {
    case 'easy':
      return theme.success
    case 'medium':
      return theme.warning
    case 'hard':
      return theme.error
    case 'insane':
      return '#dc2626' // darker red
    default:
      return theme.muted
  }
}
