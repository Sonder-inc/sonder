import { useState, useCallback } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { useTheme, useThemeStore } from '../../hooks/use-theme'
import { getApiKeyStatuses, setApiKey, loadConfig, saveConfig, type ApiKeysConfig } from '../../utils/user-config'
import { MODELS, type ModelName } from '../../constants/app-constants'
import type { ThemeName } from '../../types/theme'

const THEMES: ThemeName[] = ['dark', 'light']

interface ConfigPanelProps {
  onClose: () => void
}

type ConfigSection = 'main' | 'apikeys' | 'model' | 'theme' | 'edit-key'
type ApiKeyName = keyof ApiKeysConfig

const API_KEY_LABELS: Record<ApiKeyName, { name: string; description: string }> = {
  openrouter: { name: 'OpenRouter', description: 'Required for AI models' },
  hackthebox: { name: 'HackTheBox', description: 'HTB platform integration' },
  tryhackme: { name: 'TryHackMe', description: 'THM platform integration' },
  firecrawl: { name: 'Firecrawl', description: 'Web scraping API' },
}

export const ConfigPanel = ({ onClose }: ConfigPanelProps) => {
  const theme = useTheme()
  const setThemeName = useThemeStore((state) => state.setThemeName)
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

  // Handle keyboard navigation
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
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
      },
      [section, selectedIndex, editingKey, inputValue, onClose, config, mainMenuItems, apiKeyItems, theme.name, setThemeName]
    )
  )

  // Render based on current section
  if (section === 'edit-key' && editingKey) {
    const keyInfo = API_KEY_LABELS[editingKey]
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
        <text style={{ fg: theme.accent }}>Set {keyInfo.name} API Key</text>
        <text style={{ fg: theme.muted, marginTop: 1 }}>{keyInfo.description}</text>
        <box style={{ flexDirection: 'row', marginTop: 1 }}>
          <text style={{ fg: theme.foreground }}>Key: </text>
          <text style={{ fg: theme.accent }}>{inputValue ? '*'.repeat(inputValue.length) : '(type key)'}</text>
          <text style={{ fg: theme.accent }}>_</text>
        </box>
        <text style={{ fg: theme.muted, marginTop: 2 }}>Enter to save, Esc to cancel</text>
      </box>
    )
  }

  if (section === 'apikeys') {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
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
        <text style={{ fg: theme.muted, marginTop: 2 }}>Enter to edit, Esc to go back</text>
      </box>
    )
  }

  if (section === 'model') {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
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
        <text style={{ fg: theme.muted, marginTop: 2 }}>Enter to select, Esc to go back</text>
      </box>
    )
  }

  if (section === 'theme') {
    return (
      <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
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
        <text style={{ fg: theme.muted, marginTop: 2 }}>Enter to select, Esc to go back</text>
      </box>
    )
  }

  // Main menu
  return (
    <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
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
      <text style={{ fg: theme.muted, marginTop: 2 }}>Enter to select, Esc to close</text>
    </box>
  )
}
