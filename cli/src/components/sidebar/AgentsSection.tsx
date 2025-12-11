import { useMemo } from 'react'
import { useTheme } from '../../hooks/use-theme'
import { SidebarSection, SidebarRow } from './SidebarSection'
import { useChatStore } from '../../state/chat-store'
import { getSmartToolNames } from '../../smart-tools/registry'
import type { ToolCallStatus } from '../../types/chat'

interface AgentsSectionProps {
  isActive: boolean
  width: number
}

export const AgentsSection = ({ isActive, width }: AgentsSectionProps) => {
  const theme = useTheme()
  const toolCalls = useChatStore((state) => state.toolCalls)

  // Get smart tool names for filtering
  const smartToolNames = useMemo(() => new Set(getSmartToolNames()), [])

  // Filter and aggregate
  const agentCounts = useMemo(() => {
    // Filter only smart tools
    const smartToolCalls = toolCalls.filter(tc => smartToolNames.has(tc.toolName))

    // Aggregate by toolName
    const counts = new Map<string, {count: number, status: ToolCallStatus}>()

    for (const tc of smartToolCalls) {
      const existing = counts.get(tc.toolName)
      if (!existing) {
        counts.set(tc.toolName, {count: 1, status: tc.status})
      } else {
        existing.count++
        // Priority: executing > error > complete
        if (tc.status === 'executing' || (existing.status === 'complete' && tc.status === 'error')) {
          existing.status = tc.status
        }
      }
    }

    // Convert to array and sort
    return Array.from(counts.entries())
      .map(([name, {count, status}]) => ({name, count, status}))
      .sort((a, b) => {
        // Sort by status priority first
        const statusPriority: Record<ToolCallStatus, number> = {executing: 0, error: 1, complete: 2}
        const statusDiff = statusPriority[a.status] - statusPriority[b.status]
        if (statusDiff !== 0) return statusDiff
        // Then alphabetically
        return a.name.localeCompare(b.name)
      })
  }, [toolCalls, smartToolNames])

  // Calculate dynamic height (min 4, max based on agent count)
  const contentHeight = Math.max(1, Math.min(agentCounts.length, 12))
  const sectionHeight = contentHeight + 2 // +2 for borders

  return (
    <SidebarSection number={1} title="Agents" isActive={isActive} width={width} height={sectionHeight} flexGrow={1}>
      {agentCounts.length === 0 ? (
        <SidebarRow width={width} isActive={isActive}>
          <text fg={theme.muted}>no active agents</text>
        </SidebarRow>
      ) : (
        agentCounts.map(({name, count, status}) => {
          const indicator = status === 'executing' ? '•' : status === 'error' ? '✗' : '✓'
          const color = status === 'executing' ? theme.accent : status === 'error' ? theme.error : theme.success
          const displayName = name.length > 12 ? name.slice(0, 11) + '…' : name
          const displayCount = count > 99 ? '99+' : count.toString()

          return (
            <SidebarRow key={name} width={width} isActive={isActive}>
              <text fg={color}>{indicator}</text>
              <text fg={theme.foreground}> {displayName}</text>
              <text fg={theme.muted}>:{displayCount}</text>
            </SidebarRow>
          )
        })
      )}
    </SidebarSection>
  )
}
