import { initUserConfig } from './user-config'
import { initToolRegistry } from '../tools/registry'
import { initSmartToolRegistry } from '../smart-tools/registry'
import { mcpManager } from '../services/mcp-manager'

export interface InitResult {
  configPath: string
  configCreated: boolean
  tools: {
    loaded: number
    names: string[]
  }
  agents: {
    loaded: number
    names: string[]
  }
  mcps: {
    loaded: number
    names: string[]
  }
}

/**
 * Initialize Sonder - called at startup
 */
export async function initSonder(): Promise<InitResult> {
  // 1. Ensure ~/.sonder directory structure exists
  const { created, path } = initUserConfig()

  // 2. Load user smart tools into registry (must be before tools, smart tools are exposed as tools)
  const smartTools = await initSmartToolRegistry()

  // 3. Load user tools into registry (includes agent-as-tool adapters)
  const tools = await initToolRegistry()

  // 4. Initialize MCP manager
  const mcps = await mcpManager.init()

  return {
    configPath: path,
    configCreated: created,
    tools,
    agents: smartTools,
    mcps,
  }
}

/**
 * Get summary for display
 */
export function getInitSummary(result: InitResult): string {
  const parts: string[] = []

  if (result.configCreated) {
    parts.push(`Created config: ${result.configPath}`)
  }

  if (result.tools.loaded > 0) {
    parts.push(`Loaded ${result.tools.loaded} user tools: ${result.tools.names.join(', ')}`)
  }

  if (result.agents.loaded > 0) {
    parts.push(`Loaded ${result.agents.loaded} user agents: ${result.agents.names.join(', ')}`)
  }

  if (result.mcps.loaded > 0) {
    parts.push(`Loaded ${result.mcps.loaded} MCPs: ${result.mcps.names.join(', ')}`)
  }

  return parts.join('\n')
}
