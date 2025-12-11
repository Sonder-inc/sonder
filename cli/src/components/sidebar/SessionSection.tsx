import { useTheme } from '../../hooks/use-theme'
import { SidebarSection, SidebarRow } from './SidebarSection'
import { useHackingStore } from '../../state/hacking-store'
import { useEffect, useState } from 'react'

interface SessionSectionProps {
  isActive: boolean
  width: number
}

export const SessionSection = ({ isActive, width }: SessionSectionProps) => {
  const theme = useTheme()
  const { session, getSessionDuration } = useHackingStore()
  const [duration, setDuration] = useState(0)

  // Update duration every second when session is active
  useEffect(() => {
    if (!session.startTime) {
      setDuration(0)
      return
    }

    const interval = setInterval(() => {
      setDuration(getSessionDuration())
    }, 1000)

    return () => clearInterval(interval)
  }, [session.startTime, getSessionDuration])

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '…'
  }

  const contentWidth = width - 4

  return (
    <SidebarSection
      number={4}
      title="Session"
      isActive={isActive}
      width={width}
      height={12}
    >
      {!session.target ? (
        <SidebarRow width={width} isActive={isActive}>
          <text fg={theme.muted}>No active target</text>
        </SidebarRow>
      ) : (
        <>
          {/* Target info */}
          <SidebarRow width={width} isActive={isActive}>
            <text fg={theme.muted}>Target: </text>
            <text fg={theme.foreground}>{truncate(session.target, contentWidth - 8)}</text>
          </SidebarRow>

          {session.targetName && (
            <SidebarRow width={width} isActive={isActive}>
              <text fg={theme.muted}>Name: </text>
              <text fg={theme.foreground}>{truncate(session.targetName, contentWidth - 6)}</text>
            </SidebarRow>
          )}

          {/* Duration */}
          <SidebarRow width={width} isActive={isActive}>
            <text fg={theme.muted}>Time: </text>
            <text fg={theme.foreground}>{formatDuration(duration)}</text>
          </SidebarRow>

          {/* Empty row for spacing */}
          <SidebarRow width={width} isActive={isActive}>
            <text>{' '}</text>
          </SidebarRow>

          {/* Phase indicator */}
          <SidebarRow width={width} isActive={isActive}>
            <text fg={theme.muted}>Phase: </text>
            <text
              fg={
                session.currentPhase === 'recon'
                  ? theme.info
                  : session.currentPhase === 'exploit'
                    ? theme.warning
                    : session.currentPhase === 'post-exploit'
                      ? theme.accent
                      : theme.success
              }
            >
              {session.currentPhase === 'recon'
                ? 'Reconnaissance'
                : session.currentPhase === 'exploit'
                  ? 'Exploitation'
                  : session.currentPhase === 'post-exploit'
                    ? 'Post-Exploitation'
                    : 'Reporting'}
            </text>
          </SidebarRow>

          {/* Empty row for spacing */}
          <SidebarRow width={width} isActive={isActive}>
            <text>{' '}</text>
          </SidebarRow>

          {/* Flags */}
          <SidebarRow width={width} isActive={isActive}>
            <text fg={theme.muted}>
              Flags
            </text>
          </SidebarRow>

          <SidebarRow width={width} isActive={isActive}>
            <text fg={session.hasUserFlag ? theme.success : theme.muted}>
              {session.hasUserFlag ? '◆' : '◇'} User
            </text>
          </SidebarRow>

          <SidebarRow width={width} isActive={isActive}>
            <text fg={session.hasRootFlag ? theme.success : theme.muted}>
              {session.hasRootFlag ? '◆' : '◇'} Root
            </text>
          </SidebarRow>

          {/* Shell status */}
          {session.hasShell && (
            <>
              <SidebarRow width={width} isActive={isActive}>
                <text>{' '}</text>
              </SidebarRow>
              <SidebarRow width={width} isActive={isActive}>
                <text fg={theme.success}>
                  Shell: {session.shellType || 'unknown'}
                </text>
              </SidebarRow>
            </>
          )}
        </>
      )}
    </SidebarSection>
  )
}
