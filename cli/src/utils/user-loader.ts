import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { ToolDefinition } from '../tools/types'
import type { AgentDefinition } from '../agents/types'
import { USER_DIRS, listUserFiles, type MCPServerConfig } from './user-config'

/**
 * Dynamically load user-defined tools from ~/.sonder/tools/
 * Uses Bun's native import() for TypeScript files
 */
export async function loadUserTools(): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = []
  const files = listUserFiles('tools')

  for (const file of files) {
    // Skip example files
    if (file.isExample) continue

    try {
      // Bun can import .ts files directly
      const module = await import(file.path)

      // Find exported tool definitions
      for (const [key, value] of Object.entries(module)) {
        if (isToolDefinition(value)) {
          tools.push(value)
        }
      }
    } catch (err) {
      console.error(`Failed to load user tool ${file.name}:`, err)
    }
  }

  return tools
}

/**
 * Dynamically load user-defined agents from ~/.sonder/agents/
 */
export async function loadUserAgents(): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = []
  const files = listUserFiles('agents')

  for (const file of files) {
    // Skip example files
    if (file.isExample) continue

    try {
      const module = await import(file.path)

      // Find exported agent definitions
      for (const [key, value] of Object.entries(module)) {
        if (isAgentDefinition(value)) {
          agents.push(value)
        }
      }
    } catch (err) {
      console.error(`Failed to load user agent ${file.name}:`, err)
    }
  }

  return agents
}

/**
 * Load MCP server configurations from ~/.sonder/mcps/
 */
export function loadUserMCPs(): Map<string, MCPServerConfig> {
  const mcps = new Map<string, MCPServerConfig>()
  const files = listUserFiles('mcps')

  for (const file of files) {
    // Skip example files
    if (file.isExample) continue

    try {
      const content = readFileSync(file.path, 'utf-8')
      const config = JSON.parse(content) as MCPServerConfig & { name?: string }

      const name = config.name || file.name
      mcps.set(name, {
        command: config.command,
        args: config.args,
        env: config.env,
        enabled: config.enabled ?? true,
      })
    } catch (err) {
      console.error(`Failed to load MCP config ${file.name}:`, err)
    }
  }

  return mcps
}

/**
 * Type guard for tool definitions
 */
function isToolDefinition(value: unknown): value is ToolDefinition {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.execute === 'function' &&
    obj.parameters !== undefined
  )
}

/**
 * Type guard for agent definitions
 */
function isAgentDefinition(value: unknown): value is AgentDefinition {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.systemPrompt === 'string' &&
    typeof obj.execute === 'function' &&
    obj.parameters !== undefined
  )
}

/**
 * Get summary of loaded user extensions
 */
export async function getUserExtensionsSummary(): Promise<{
  tools: string[]
  agents: string[]
  mcps: string[]
}> {
  const [tools, agents] = await Promise.all([loadUserTools(), loadUserAgents()])
  const mcps = loadUserMCPs()

  return {
    tools: tools.map(t => t.name),
    agents: agents.map(a => a.name),
    mcps: Array.from(mcps.keys()),
  }
}
