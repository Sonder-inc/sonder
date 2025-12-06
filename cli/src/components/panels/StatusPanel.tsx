import { useTheme } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { getToolNames } from '../../tools/registry'
import { getAgentNames } from '../../agents/registry'

interface StatusPanelProps {
  model: string      // Display name (e.g., "sonder", "opus 4.5")
  modelId: string    // API ID for context limit lookup
  mode: string
  version: string
}

// Unicode symbols for the grid (using common symbols that render in most terminals)
const FILLED = '\u2593'   // ▓
const EMPTY = '\u2591'    // ░
const RESERVED = '\u2592' // ▒

// Model context limits
const MODEL_LIMITS: Record<string, number> = {
  'anthropic/claude-3.7-sonnet:thinking': 200_000,
  'anthropic/claude-opus-4.5': 200_000,
  'openai/gpt-5.1': 128_000,
  'google/gemini-3-pro-preview': 1_000_000,
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return tokens.toString()
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export const StatusPanel = ({ model, modelId, mode, version }: StatusPanelProps) => {
  const theme = useTheme()
  const messages = useChatStore((s) => s.messages)
  const toolCalls = useChatStore((s) => s.toolCalls)

  // Calculate usage
  const systemPrompt = 500
  const tools = getToolNames().length * 200
  const messageTokens = messages.reduce((acc, m) => acc + estimateTokens(m.content), 0)
  const toolCallTokens = toolCalls.reduce((acc, tc) => acc + estimateTokens(tc.fullResult || ''), 0)
  const total = systemPrompt + tools + messageTokens + toolCallTokens
  const limit = MODEL_LIMITS[modelId] || 200_000
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

  // Build grid string
  const gridLines: string[] = []
  for (let row = 0; row < 10; row++) {
    let line = ''
    for (let col = 0; col < 10; col++) {
      const { sym } = getCell(row * 10 + col)
      line += sym + ' '
    }
    gridLines.push(line)
  }

  return (
    <box style={{ flexDirection: 'column', marginLeft: 1, marginTop: 1 }}>
      <text style={{ fg: theme.accent }}>Context Usage</text>

      <box style={{ flexDirection: 'row', marginTop: 1 }}>
        <box style={{ flexDirection: 'column' }}>
          {gridLines.map((line, i) => (
            <text key={i} style={{ fg: theme.muted }}>{line}</text>
          ))}
        </box>

        <box style={{ flexDirection: 'column', marginLeft: 2 }}>
          <text style={{ fg: theme.muted }}>{model} {formatTokens(total)}/{formatTokens(limit)} ({percentage}%)</text>
          <text style={{ fg: '#a8a29e' }}>{FILLED} System: {formatTokens(systemPrompt)}</text>
          <text style={{ fg: '#c084fc' }}>{FILLED} Tools: {formatTokens(tools)}</text>
          <text style={{ fg: '#818cf8' }}>{FILLED} Messages: {formatTokens(messageTokens + toolCallTokens)}</text>
          <text style={{ fg: '#52525b' }}>{EMPTY} Free: {formatTokens(freeSpace)}</text>
          <text style={{ fg: '#71717a' }}>{RESERVED} Buffer: {formatTokens(reserveBuffer)}</text>
        </box>
      </box>

      <text style={{ fg: theme.accent, marginTop: 1 }}>Extensions</text>
      <text style={{ fg: theme.muted }}>Tools: {getToolNames().length} | Agents: {getAgentNames().length}</text>

      <text style={{ fg: theme.accent, marginTop: 1 }}>Session</text>
      <text style={{ fg: theme.muted }}>v{version} | {mode} | {messages.length} messages</text>

      <text style={{ fg: theme.muted, marginTop: 1 }}>Press any key to close</text>
    </box>
  )
}
