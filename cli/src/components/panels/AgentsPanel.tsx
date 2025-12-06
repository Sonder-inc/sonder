import { useState, useEffect } from 'react'
import { useTheme } from '../../hooks/use-theme'
import { ShimmerText } from '../shimmer-text'
import { getToolNames, getToolDescriptions, isUserTool } from '../../tools/registry'
import { getAgentNames, getAgentDescriptions, isUserAgent } from '../../agents/registry'
import { mcpManager } from '../../services/mcp-manager'
import { USER_DIRS } from '../../utils/user-config'

type Tab = 'tools' | 'agents' | 'mcps'

interface AgentsPanelProps {
  selectedIndex: number
  onClose: () => void
}

export const AgentsPanel = ({ selectedIndex, onClose }: AgentsPanelProps) => {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState<Tab>('tools')

  const tabs: Tab[] = ['tools', 'agents', 'mcps']

  // Get data for each tab
  const toolNames = getToolNames()
  const toolDescs = getToolDescriptions()
  const agentNames = getAgentNames()
  const agentDescs = getAgentDescriptions()
  const mcpStatus = mcpManager.getStatus()

  // Calculate which tab is selected based on selectedIndex
  const tabIndex = selectedIndex % tabs.length
  useEffect(() => {
    setActiveTab(tabs[tabIndex])
  }, [tabIndex])

  const renderTabHeader = () => (
    <box style={{ flexDirection: 'row', marginBottom: 1 }}>
      {tabs.map((tab, idx) => (
        <text
          key={tab}
          style={{
            fg: tab === activeTab ? theme.accent : theme.muted,
            marginRight: 2,
          }}
        >
          {tab === activeTab ? `[${tab}]` : tab}
        </text>
      ))}
      <text style={{ fg: theme.muted, marginLeft: 2 }}>
        tab to switch | q to close
      </text>
    </box>
  )

  const renderTools = () => (
    <box style={{ flexDirection: 'column' }}>
      {toolNames.map(name => {
        const isUser = isUserTool(name)
        return (
          <box key={name} style={{ flexDirection: 'row' }}>
            <text style={{ fg: isUser ? theme.accent : theme.foreground, width: 16 }}>
              {name}
            </text>
            <text style={{ fg: theme.muted }}>
              {toolDescs[name]?.slice(0, 50) || ''}
              {isUser ? ' (user)' : ''}
            </text>
          </box>
        )
      })}
      <text style={{ fg: theme.muted, marginTop: 1 }}>
        Add tools: {USER_DIRS.tools}
      </text>
    </box>
  )

  const renderAgents = () => (
    <box style={{ flexDirection: 'column' }}>
      {agentNames.map(name => {
        const isUser = isUserAgent(name)
        return (
          <box key={name} style={{ flexDirection: 'row' }}>
            <text style={{ fg: isUser ? theme.accent : theme.foreground, width: 16 }}>
              {name}
            </text>
            <text style={{ fg: theme.muted }}>
              {agentDescs[name]?.slice(0, 50) || ''}
              {isUser ? ' (user)' : ''}
            </text>
          </box>
        )
      })}
      <text style={{ fg: theme.muted, marginTop: 1 }}>
        Add agents: {USER_DIRS.agents}
      </text>
    </box>
  )

  const renderMCPs = () => (
    <box style={{ flexDirection: 'column' }}>
      {mcpStatus.length === 0 ? (
        <text style={{ fg: theme.muted }}>No MCPs configured</text>
      ) : (
        mcpStatus.map(mcp => (
          <box key={mcp.name} style={{ flexDirection: 'row' }}>
            <text
              style={{
                fg:
                  mcp.status === 'running'
                    ? theme.success
                    : mcp.status === 'error'
                    ? theme.error
                    : theme.muted,
                width: 16,
              }}
            >
              {mcp.name}
            </text>
            <text style={{ fg: theme.muted }}>
              {mcp.status}
              {mcp.error ? ` - ${mcp.error}` : ''}
            </text>
          </box>
        ))
      )}
      <text style={{ fg: theme.muted, marginTop: 1 }}>
        Add MCPs: {USER_DIRS.mcps}
      </text>
    </box>
  )

  return (
    <box
      style={{
        flexDirection: 'column',
        marginLeft: 1,
        marginTop: 1,
        padding: 1,
        border: true,
        borderStyle: 'single',
        borderColor: theme.borderColor,
      }}
    >
      <text style={{ fg: theme.accent, marginBottom: 1 }}>
        <ShimmerText text="Extensions" primaryColor={theme.accent} interval={100} />
      </text>

      {renderTabHeader()}

      {activeTab === 'tools' && renderTools()}
      {activeTab === 'agents' && renderAgents()}
      {activeTab === 'mcps' && renderMCPs()}
    </box>
  )
}
