/**
 * Agent Registry
 *
 * Single source of truth for all agents: built-in and user-defined.
 * Extends BaseRegistry with agent-specific execution routing.
 */

import type { AgentContext, AgentResult, AnyAgentDefinition } from './types'
import { isGeneratorAgent } from './types'
import { loadUserAgents } from '../utils/user-loader'
import { executeGeneratorAgent } from '../services/generator-executor'
import { BaseRegistry } from '../registries/base-registry'

// Import all built-in agents
import { bestOfNAgent } from './best-of-n-agent'
import { reviewerAgent } from './reviewer-agent'
import { commanderAgent } from './commander-agent'
import { editorAgent } from './editor-agent'
import { exploreAgent } from './explore-agent'
import { searchFetchAgent } from './researcher-web-agent'
import { compactAgent } from './context-pruner-agent'
import { interrogatorAgent } from './interrogator-agent'
import { hinterAgent } from './hinter-agent'
import { reconAgent } from './recon-agent'
import { cryptoAgent } from './crypto-agent'
import { reverseAgent } from './reverse-agent'
import { seAgent } from './se-agent'
import { vgrepAgent } from './vgrep-agent'
import { vglobAgent } from './vglob-agent'

type AnyAgent = AnyAgentDefinition<any, any>

/**
 * Built-in agents
 */
const builtInAgents: AnyAgent[] = [
  bestOfNAgent,
  reviewerAgent,
  commanderAgent,
  editorAgent,
  exploreAgent,
  searchFetchAgent,
  compactAgent,
  interrogatorAgent,
  hinterAgent,
  reconAgent,
  cryptoAgent,
  reverseAgent,
  seAgent,
  vgrepAgent,
  vglobAgent,
]

/**
 * Agent Registry with execution routing
 */
class AgentRegistry extends BaseRegistry<AnyAgent> {
  private builtInNames: Set<string>

  constructor() {
    super()
    this.builtInNames = new Set(builtInAgents.map((a) => a.name))
  }

  /**
   * Initialize with built-in and user agents
   */
  async init(): Promise<{ loaded: number; names: string[] }> {
    if (this.initialized) {
      return { loaded: 0, names: [] }
    }

    // Register built-in agents
    for (const agent of builtInAgents) {
      this.registerBuiltIn(agent)
    }

    // Load and register user agents (can override built-in)
    const userAgents = await loadUserAgents()
    for (const agent of userAgents) {
      this.registerUser(agent)
    }

    this.initialized = true

    return {
      loaded: userAgents.length,
      names: userAgents.map((a) => a.name),
    }
  }

  /**
   * Execute an agent by name
   * Automatically routes to generator executor for handleSteps agents
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<AgentResult> {
    const agent = this.get(name)

    if (!agent) {
      return {
        success: false,
        summary: `Unknown agent: ${name}`,
      }
    }

    // Validate parameters
    const parsed = agent.parameters.safeParse(params)
    if (!parsed.success) {
      return {
        success: false,
        summary: 'Invalid parameters',
      }
    }

    // Route to appropriate executor
    if (isGeneratorAgent(agent)) {
      return executeGeneratorAgent({
        agent,
        params: parsed.data as Record<string, unknown>,
        prompt: (parsed.data as any)?.prompt,
        context,
      })
    }

    // Legacy async execute
    if ('execute' in agent && typeof agent.execute === 'function') {
      return agent.execute(parsed.data as never, context)
    }

    return {
      success: false,
      summary: `Agent ${name} has no executor`,
    }
  }

  /**
   * Get rich agent info including parameter schemas
   */
  getSchemas(): Record<string, { description: string; spawnerPrompt?: string; params: Record<string, string> }> {
    const result: Record<string, { description: string; spawnerPrompt?: string; params: Record<string, string> }> = {}

    for (const agent of this.getAll()) {
      if (agent.name === 'council') continue

      const params: Record<string, string> = {}
      const shape = (agent.parameters as any)?._def?.shape?.()

      if (shape) {
        for (const [key, value] of Object.entries(shape)) {
          const desc = (value as any)?._def?.description || (value as any)?.description
          const typeName = (value as any)?._def?.typeName || 'unknown'
          params[key] = desc || typeName
        }
      }

      const spawnerPrompt = isGeneratorAgent(agent) ? agent.spawnerPrompt : undefined

      result[agent.name] = {
        description: spawnerPrompt || agent.description,
        spawnerPrompt,
        params,
      }
    }

    return result
  }

  /**
   * Check if an agent is user-defined (not a built-in override)
   */
  isUserAgent(name: string): boolean {
    return !this.builtInNames.has(name) && this.has(name)
  }

  // Aliases for backward compatibility
  getAgent(name: string): AnyAgent | undefined {
    return this.get(name)
  }

  getAgentNames(): string[] {
    return this.getNames()
  }

  getAllAgents(): AnyAgent[] {
    return this.getAll()
  }

  getAgentDescriptions(): Record<string, string> {
    return this.getDescriptions()
  }

  getAgentSchemas() {
    return this.getSchemas()
  }
}

// Singleton instance
const agentRegistry = new AgentRegistry()

// =============================================================================
// Exports
// =============================================================================

export type AgentName = string

export async function initAgentRegistry(): Promise<{ loaded: number; names: string[] }> {
  return agentRegistry.init()
}

export function getAgent(name: string): AnyAgent | undefined {
  return agentRegistry.getAgent(name)
}

export async function executeAgent(
  name: string,
  params: Record<string, unknown>,
  context: AgentContext
): Promise<AgentResult> {
  return agentRegistry.execute(name, params, context)
}

export function getAgentNames(): string[] {
  return agentRegistry.getAgentNames()
}

export function getAllAgents(): AnyAgent[] {
  return agentRegistry.getAllAgents()
}

export function getAgentDescriptions(): Record<string, string> {
  return agentRegistry.getAgentDescriptions()
}

export function getAgentSchemas() {
  return agentRegistry.getAgentSchemas()
}

export function isUserAgent(name: string): boolean {
  return agentRegistry.isUserAgent(name)
}

// Export the registry instance for direct access if needed
export { agentRegistry }
