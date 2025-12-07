import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { ToolDefinition } from '../tools/types'
import type { SmartToolDefinition } from '../smart-tools/types'
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
 * Dynamically load user-defined smart tools from ~/.sonder/smart-tools/
 */
export async function loadUserSmartTools(): Promise<SmartToolDefinition[]> {
  const smartTools: SmartToolDefinition[] = []
  const files = listUserFiles('agents') // User smart tools stored in ~/.sonder/agents/

  for (const file of files) {
    // Skip example files
    if (file.isExample) continue

    try {
      const module = await import(file.path)

      // Find exported smart tool definitions
      for (const [key, value] of Object.entries(module)) {
        if (isSmartToolDefinition(value)) {
          smartTools.push(value)
        }
      }
    } catch (err) {
      console.error(`Failed to load user smart tool ${file.name}:`, err)
    }
  }

  return smartTools
}

/** @deprecated Use loadUserSmartTools */
export const loadUserAgents = loadUserSmartTools

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
 * Type guard for smart tool definitions
 */
function isSmartToolDefinition(value: unknown): value is SmartToolDefinition {
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
  smartTools: string[]
  mcps: string[]
}> {
  const [tools, smartTools] = await Promise.all([loadUserTools(), loadUserSmartTools()])
  const mcps = loadUserMCPs()

  return {
    tools: tools.map(t => t.name),
    smartTools: smartTools.map(t => t.name),
    mcps: Array.from(mcps.keys()),
  }
}
