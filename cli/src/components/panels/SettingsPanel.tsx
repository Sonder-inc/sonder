import { useState, useCallback } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { useTheme, useThemeStore } from '../../hooks/use-theme'
import { getApiKeyStatuses, setApiKey, loadConfig, saveConfig, type ApiKeysConfig } from '../../utils/user-config'
import { MODELS, type ModelName, MODEL_CONTEXT_LIMITS, DEFAULT_CONTEXT_LIMIT } from '../../constants/app-constants'
import type { ThemeName } from '../../types/theme'
import { useChatStore } from '../../state/chat-store'
import { getToolNames } from '../../tools/registry'
import { getSmartToolNames } from '../../smart-tools/registry'
import { formatTokens, estimateTokens } from '../../utils/tokens'

const THEMES: ThemeName[] = ['dark', 'light']

// Unicode symbols for the grid
const FILLED = '\u2593'   // ▓
const EMPTY = '\u2591'    // ░
const RESERVED = '\u2592' // ▒

export type SettingsTab = 'Config' | 'Status' | 'Usage' | 'Context'

interface SettingsPanelProps {
  onClose: () => void
  initialTab?: SettingsTab
  model: string      // Display name (e.g., "sonder", "opus 4.5")
  modelId: string    // API ID for context limit lookup
  mode: string
  version: string
  thinkingEnabled: boolean
}

type ConfigSection = 'main' | 'apikeys' | 'model' | 'theme' | 'edit-key'
type ApiKeyName = keyof ApiKeysConfig

const API_KEY_LABELS: Record<ApiKeyName, { name: string; description: string }> = {
  openrouter: { name: 'OpenRouter', description: 'Required for AI models' },
  hackthebox: { name: 'HackTheBox', description: 'HTB platform integration' },
  tryhackme: { name: 'TryHackMe', description: 'THM platform integration' },
  firecrawl: { name: 'Firecrawl', description: 'Web scraping API' },
}

export const SettingsPanel = ({ onClose, initialTab = 'Config', model, modelId, mode, version, thinkingEnabled }: SettingsPanelProps) => {
  const theme = useTheme()
  const setThemeName = useThemeStore((state) => state.setThemeName)
  const messages = useChatStore((s) => s.messages)
  const toolCalls = useChatStore((s) => s.toolCalls)

  const TABS: SettingsTab[] = ['Config', 'Status', 'Usage', 'Context']
  const [currentTab, setCurrentTab] = useState<SettingsTab>(initialTab)
  const [section, setSection] = useState<ConfigSection>('main')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editingKey, setEditingKey] = useState<ApiKeyName | null>(null)
  const [inputValue, setInputValue] = useState('')

  const apiKeyStatuses = getApiKeyStatuses()
  const config = loadConfig()

  const mainMenuItems = [
    { id: 'apikeys', label: 'API Keys', description: 'Configure API keys' },
    { id: 'model', label: 'Default Model', description: config.defaultModel || 'sonder' },
    { id: 'theme', label: 'Theme', description: config.theme || 'default' },
  ]

  const apiKeyItems = Object.entries(API_KEY_LABELS).map(([key, info]) => {
    const status = apiKeyStatuses[key as ApiKeyName]
    return {
      id: key as ApiKeyName,
      label: info.name,
      description: info.description,
      configured: status.configured,
      source: status.source,
    }
  })

  // Cycle to next tab
  const cycleTab = () => {
    const currentIndex = TABS.indexOf(currentTab)
    const nextIndex = (currentIndex + 1) % TABS.length
    setCurrentTab(TABS[nextIndex])
    setSection('main')
    setSelectedIndex(0)
  }

  // Handle keyboard navigation
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        // Tab key cycles through tabs (only when not in a subsection)
        if (key.name === 'tab' && currentTab === 'Config' && section === 'main') {
          cycleTab()
          return
        }
        if (key.name === 'tab' && currentTab !== 'Config') {
          cycleTab()
          return
        }

        // Config tab specific keyboard handling
        if (currentTab === 'Config') {
          if (section === 'edit-key') {
            if (key.name === 'escape') {
              setSection('apikeys')
              setEditingKey(null)
              setInputValue('')
            } else if (key.name === 'return' && editingKey) {
              if (inputValue.trim()) {
                setApiKey(editingKey, inputValue.trim())
              }
              setSection('apikeys')
              setEditingKey(null)
              setInputValue('')
            } else if (key.name === 'backspace') {
              setInputValue(prev => prev.slice(0, -1))
            } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
              setInputValue(prev => prev + key.sequence)
            }
            return
          }

          if (key.name === 'escape') {
            if (section === 'main') {
              onClose()
            } else {
              setSection('main')
              setSelectedIndex(0)
            }
            return
          }

          const items = section === 'main' ? mainMenuItems : section === 'apikeys' ? apiKeyItems : section === 'model' ? MODELS : THEMES
          const maxIndex = items.length - 1

          if (key.name === 'up' || key.name === 'k') {
            setSelectedIndex(prev => Math.max(0, prev - 1))
          } else if (key.name === 'down' || key.name === 'j') {
            setSelectedIndex(prev => Math.min(maxIndex, prev + 1))
          } else if (key.name === 'return') {
            if (section === 'main') {
              const item = mainMenuItems[selectedIndex]
              if (item.id === 'apikeys') {
                setSection('apikeys')
                setSelectedIndex(0)
              } else if (item.id === 'model') {
                setSection('model')
                setSelectedIndex(MODELS.indexOf((config.defaultModel as ModelName) || 'sonder'))
              } else if (item.id === 'theme') {
                setSection('theme')
                setSelectedIndex(THEMES.indexOf((theme.name as ThemeName) || 'dark'))
              }
            } else if (section === 'apikeys') {
              const item = apiKeyItems[selectedIndex]
              setEditingKey(item.id)
              setInputValue('')
              setSection('edit-key')
            } else if (section === 'model') {
              const newConfig = { ...config, defaultModel: MODELS[selectedIndex] }
              saveConfig(newConfig)
              setSection('main')
              setSelectedIndex(1)
            } else if (section === 'theme') {
              const selectedTheme = THEMES[selectedIndex]
              setThemeName(selectedTheme)
              const newConfig = { ...config, theme: selectedTheme }
              saveConfig(newConfig)
              setSection('main')
              setSelectedIndex(2)
            }
          }
        } else {
          // Other tabs just close on escape or any key
          if (key.name === 'escape') {
            onClose()
          }
        }
      },
      [currentTab, section, selectedIndex, editingKey, inputValue, onClose, config, mainMenuItems, apiKeyItems, theme.name, setThemeName]
    )
  )

  // Render tab header
  const renderTabHeader = () => {
    return (
      <box style={{ flexDirection: 'row', marginBottom: 1 }}>
        <text style={{ fg: theme.muted }}>Settings: </text>
        {TABS.map((tab, idx) => (
          <text key={tab} style={{ fg: tab === currentTab ? theme.accent : theme.muted }}>
            {tab}{idx < TABS.length - 1 ? ' ' : ''}
          </text>
        ))}
        <text style={{ fg: theme.muted }}> (tab to cycle)(esc to close)</text>
      </box>
    )
  }

  // Render Config tab content
  const renderConfigTab = () => {
    // Edit key section
    if (section === 'edit-key' && editingKey) {
      const keyInfo = API_KEY_LABELS[editingKey]
      return (
        <box style={{ flexDirection: 'column' }}>
          <text style={{ fg: theme.accent }}>Set {keyInfo.name} API Key</text>
          <text style={{ fg: theme.muted, marginTop: 1 }}>{keyInfo.description}</text>
          <box style={{ flexDirection: 'row', marginTop: 1 }}>
            <text style={{ fg: theme.foreground }}>Key: </text>
            <text style={{ fg: theme.accent }}>{inputValue ? '*'.repeat(inputValue.length) : '(type key)'}</text>
            <text style={{ fg: theme.accent }}>_</text>
          </box>
        </box>
      )
    }

    // API keys section
    if (section === 'apikeys') {
      return (
        <box style={{ flexDirection: 'column' }}>
          <text style={{ fg: theme.accent }}>API Keys</text>
          <box style={{ flexDirection: 'column', marginTop: 1 }}>
            {apiKeyItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const statusIcon = item.configured ? '\u2713' : '\u2717'
              const statusColor = item.configured ? theme.success : theme.error
              return (
                <box key={item.id} style={{ flexDirection: 'row' }}>
                  <text style={{ fg: statusColor }}>{statusIcon} </text>
                  <text style={{ fg: isSelected ? theme.accent : theme.foreground }}>
                    {item.label}
                  </text>
                  <text style={{ fg: theme.muted }}>
                    {' '}- {item.configured ? `(${item.source})` : 'not set'}
                  </text>
                </box>
              )
            })}
          </box>
        </box>
      )
    }

    // Model section
    if (section === 'model') {
      return (
        <box style={{ flexDirection: 'column' }}>
          <text style={{ fg: theme.accent }}>Default Model</text>
          <box style={{ flexDirection: 'column', marginTop: 1 }}>
            {MODELS.map((model, idx) => {
              const isSelected = idx === selectedIndex
              const isCurrent = model === (config.defaultModel || 'sonder')
              return (
                <text key={model} style={{ fg: isSelected ? theme.accent : theme.foreground }}>
                  {isCurrent ? '\u2713 ' : '  '}{model}
                </text>
              )
            })}
          </box>
        </box>
      )
    }

    // Theme section
    if (section === 'theme') {
      return (
        <box style={{ flexDirection: 'column' }}>
          <text style={{ fg: theme.accent }}>Theme</text>
          <box style={{ flexDirection: 'column', marginTop: 1 }}>
            {THEMES.map((themeName, idx) => {
              const isSelected = idx === selectedIndex
              const isCurrent = themeName === theme.name
              return (
                <text key={themeName} style={{ fg: isSelected ? theme.accent : theme.foreground }}>
                  {isCurrent ? '\u2713 ' : '  '}{themeName}
                </text>
              )
            })}
          </box>
        </box>
      )
    }

    // Main menu
    return (
      <box style={{ flexDirection: 'column' }}>
        <text style={{ fg: theme.accent }}>Configuration</text>
        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          {mainMenuItems.map((item, idx) => {
            const isSelected = idx === selectedIndex
            return (
              <box key={item.id} style={{ flexDirection: 'row' }}>
                <text style={{ fg: isSelected ? theme.accent : theme.foreground }}>
                  {item.label}
                </text>
                <text style={{ fg: theme.muted }}> - {item.description}</text>
              </box>
            )
          })}
        </box>
      </box>
    )
  }

  // Render Status tab content
  const renderStatusTab = () => {
    return (
      <box style={{ flexDirection: 'column' }}>
        <text style={{ fg: theme.accent }}>System Status</text>
        <box style={{ flexDirection: 'column', marginTop: 1 }}>
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.muted }}>Version: </text>
            <text style={{ fg: theme.foreground }}>{version}</text>
          </box>
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.muted }}>Mode: </text>
            <text style={{ fg: theme.foreground }}>{mode}</text>
          </box>
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.muted }}>Model: </text>
            <text style={{ fg: thinkingEnabled ? theme.accent : theme.foreground }}>{model}</text>
          </box>
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.muted }}>Thinking: </text>
            <text style={{ fg: thinkingEnabled ? theme.success : theme.error }}>
              {thinkingEnabled ? 'Enabled' : 'Disabled'}
            </text>
          </box>
        </box>
      </box>
    )
  }

  // Render Usage tab content
  const renderUsageTab = () => {
    // Helper function to render progress bar with label superimposed
    const renderProgressBar = (percentage: number, label: string, barWidth: number = 50) => {
      const filledWidth = Math.floor((percentage / 100) * barWidth)
      const filledColor = percentage < 40 ? '#818cf8' : percentage < 70 ? '#fbbf24' : '#f87171'
      const emptyColor = '#52525b'

      // Pad label to fill bar width, truncate if too long
      const paddedLabel = label.padEnd(barWidth).slice(0, barWidth)
      const filledPart = paddedLabel.slice(0, filledWidth)
      const emptyPart = paddedLabel.slice(filledWidth)

      return (
        <box style={{ flexDirection: 'row' }}>
          <text style={{ bg: filledColor, fg: '#fff' }}>{filledPart}</text>
          <text style={{ bg: emptyColor, fg: '#fff' }}>{emptyPart}</text>
          <text style={{ fg: theme.foreground }}> {percentage}%</text>
        </box>
      )
    }

    return (
      <box style={{ flexDirection: 'column' }}>
        {renderProgressBar(30, 'Current session')}
        <text style={{ fg: theme.muted }}>Resets 9:59pm (America/Toronto)</text>

        <box style={{ marginTop: 1 }}>{renderProgressBar(66, 'Current week (all models)')}</box>
        <text style={{ fg: theme.muted }}>Resets Dec 15 at 2:59pm (America/Toronto)</text>

        <box style={{ marginTop: 1 }}>{renderProgressBar(14, 'Current week (sonder only)')}</box>
        <text style={{ fg: theme.muted }}>Resets Dec 15 at 3:59pm (America/Toronto)</text>

        <text style={{ fg: theme.muted, marginTop: 1 }}>Extra usage not enabled • /extra-usage to enable</text>
      </box>
    )
  }

  // Render Context tab content
  const renderContextTab = () => {
    // Calculate usage
    const systemPrompt = 500
    const tools = getToolNames().length * 200
    const messageTokens = messages.reduce((acc, m) => acc + estimateTokens(m.content), 0)
    const toolCallTokens = toolCalls.reduce((acc, tc) => acc + estimateTokens(tc.fullResult || ''), 0)
    const total = systemPrompt + tools + messageTokens + toolCallTokens
    const limit = MODEL_CONTEXT_LIMITS[modelId] || DEFAULT_CONTEXT_LIMIT
    const reserveBuffer = Math.floor(limit * 0.225)
    const freeSpace = Math.max(0, limit - total - reserveBuffer)
    const percentage = Math.round((total / limit) * 100)

    // Generate grid
    const cellValue = limit / 100
    const systemCells = Math.ceil(systemPrompt / cellValue)
    const toolCells = Math.ceil(tools / cellValue)
    const messageCells = Math.ceil((messageTokens + toolCallTokens) / cellValue)
    const reserveCells = Math.ceil(reserveBuffer / cellValue)

    const getCell = (idx: number) => {
      if (idx < systemCells) return { sym: FILLED, color: '#a8a29e' }
      if (idx < systemCells + toolCells) return { sym: FILLED, color: '#c084fc' }
      if (idx < systemCells + toolCells + messageCells) return { sym: FILLED, color: '#818cf8' }
      if (idx >= 100 - reserveCells) return { sym: RESERVED, color: '#71717a' }
      return { sym: EMPTY, color: '#52525b' }
    }

    // Build grid cells with colors
    const gridRows: Array<Array<{ sym: string; color: string }>> = []
    for (let row = 0; row < 10; row++) {
      const rowCells: Array<{ sym: string; color: string }> = []
      for (let col = 0; col < 10; col++) {
        rowCells.push(getCell(row * 10 + col))
      }
      gridRows.push(rowCells)
    }

    return (
      <box style={{ flexDirection: 'column' }}>
        <box style={{ flexDirection: 'row' }}>
          <text style={{ fg: thinkingEnabled ? theme.accent : theme.muted }}>{model}</text>
          <text style={{ fg: theme.muted }}>{' '}{formatTokens(total)}/{formatTokens(limit)} </text>
          <text style={{ fg: percentage < 40 ? theme.success : percentage < 70 ? theme.warning : theme.error }}>({percentage}%)</text>
        </box>
        <box style={{ flexDirection: 'row', marginTop: 1 }}>
          <box style={{ flexDirection: 'column', width: 20 }}>
            {gridRows.map((row, i) => (
              <box key={i} style={{ flexDirection: 'row' }}>
                {row.map((cell, j) => (
                  <text key={j} style={{ fg: cell.color }}>{cell.sym} </text>
                ))}
              </box>
            ))}
          </box>
          <box style={{ flexDirection: 'column', marginLeft: 1 }}>
            <text style={{ fg: '#a8a29e' }}>{FILLED} System: {formatTokens(systemPrompt)}</text>
            <text style={{ fg: '#c084fc' }}>{FILLED} Tools: {formatTokens(tools)}</text>
            <text style={{ fg: '#818cf8' }}>{FILLED} Messages: {formatTokens(messageTokens + toolCallTokens)}</text>
            <text style={{ fg: '#52525b' }}>{EMPTY} Free: {formatTokens(freeSpace)}</text>
            <text style={{ fg: '#71717a' }}>{RESERVED} Buffer: {formatTokens(reserveBuffer)}</text>
            <text style={{ fg: theme.muted, marginTop: 1 }}>Tools: {getToolNames().length} | Smart Tools: {getSmartToolNames().length}</text>
          </box>
        </box>
      </box>
    )
  }

  // Main render
  return (
    <box style={{ flexDirection: 'column', marginLeft: 1 }}>
      {renderTabHeader()}
      {currentTab === 'Config' && renderConfigTab()}
      {currentTab === 'Status' && renderStatusTab()}
      {currentTab === 'Usage' && renderUsageTab()}
      {currentTab === 'Context' && renderContextTab()}
    </box>
  )
}
