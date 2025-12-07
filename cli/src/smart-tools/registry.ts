/**
 * Smart Tool Registry
 *
 * Single source of truth for all smart tools: built-in and user-defined.
 * Smart tools are tools with LLM loops (via generator steps).
 */

import type { SmartToolContext, SmartToolResult, AnySmartToolDefinition } from './types'
import { isGeneratorSmartTool } from './types'
import { loadUserSmartTools } from '../utils/user-loader'
import { executeGeneratorSmartTool } from '../services/generator-executor'
import { BaseRegistry } from '../registries/base-registry'

// Import all built-in smart tools
import { bestOfN } from './best-of-n'
import { reviewer } from './reviewer'
import { searchFetch } from './search-fetch'
import { compact } from './compact'
import { interrogator } from './interrogator'
import { hinter } from './hinter'
import { recon } from './recon'
import { crypto } from './crypto'
import { reverse } from './reverse'
import { se } from './se'
import { vgrep } from './vgrep'
import { vglob } from './vglob'

type AnySmartTool = AnySmartToolDefinition<any, any>

/**
 * Built-in smart tools
 */
const builtInSmartTools: AnySmartTool[] = [
  bestOfN,
  reviewer,
  searchFetch,
  compact,
  interrogator,
  hinter,
  recon,
  crypto,
  reverse,
  se,
  vgrep,
  vglob,
]

/**
 * Smart Tool Registry with execution routing
 */
class SmartToolRegistry extends BaseRegistry<AnySmartTool> {
  private builtInNames: Set<string>

  constructor() {
    super()
    this.builtInNames = new Set(builtInSmartTools.map((t) => t.name))
  }

  /**
   * Initialize with built-in and user smart tools
   */
  async init(): Promise<{ loaded: number; names: string[] }> {
    if (this.initialized) {
      return { loaded: 0, names: [] }
    }

    // Register built-in smart tools
    for (const smartTool of builtInSmartTools) {
      this.registerBuiltIn(smartTool)
    }

    // Load and register user smart tools (can override built-in)
    const userSmartTools = await loadUserSmartTools()
    for (const smartTool of userSmartTools) {
      this.registerUser(smartTool)
    }

    this.initialized = true

    return {
      loaded: userSmartTools.length,
      names: userSmartTools.map((t) => t.name),
    }
  }

  /**
   * Execute a smart tool by name
   * Automatically routes to generator executor for handleSteps smart tools
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: SmartToolContext
  ): Promise<SmartToolResult> {
    const smartTool = this.get(name)

    if (!smartTool) {
      return {
        success: false,
        summary: `Unknown smart tool: ${name}`,
      }
    }

    // Validate parameters
    const parsed = smartTool.parameters.safeParse(params)
    if (!parsed.success) {
      return {
        success: false,
        summary: 'Invalid parameters',
      }
    }

    // Route to appropriate executor
    if (isGeneratorSmartTool(smartTool)) {
      return executeGeneratorSmartTool({
        smartTool,
        params: parsed.data as Record<string, unknown>,
        prompt: (parsed.data as any)?.prompt,
        context,
      })
    }

    // Simple execute
    if ('execute' in smartTool && typeof smartTool.execute === 'function') {
      return smartTool.execute(parsed.data as never, context)
    }

    return {
      success: false,
      summary: `Smart tool ${name} has no executor`,
    }
  }

  /**
   * Get rich smart tool info including parameter schemas
   */
  getSchemas(): Record<string, { description: string; spawnerPrompt?: string; params: Record<string, string> }> {
    const result: Record<string, { description: string; spawnerPrompt?: string; params: Record<string, string> }> = {}

    for (const smartTool of this.getAll()) {
      const params: Record<string, string> = {}
      const shape = (smartTool.parameters as any)?._def?.shape?.()

      if (shape) {
        for (const [key, value] of Object.entries(shape)) {
          const desc = (value as any)?._def?.description || (value as any)?.description
          const typeName = (value as any)?._def?.typeName || 'unknown'
          params[key] = desc || typeName
        }
      }

      const spawnerPrompt = isGeneratorSmartTool(smartTool) ? smartTool.spawnerPrompt : undefined

      result[smartTool.name] = {
        description: spawnerPrompt || smartTool.description,
        spawnerPrompt,
        params,
      }
    }

    return result
  }

  /**
   * Check if a smart tool is user-defined (not a built-in override)
   */
  isUserDefined(name: string): boolean {
    return !this.builtInNames.has(name) && this.has(name)
  }
}

// Singleton instance
const smartToolRegistry = new SmartToolRegistry()

// =============================================================================
// Exports
// =============================================================================

export async function initSmartToolRegistry(): Promise<{ loaded: number; names: string[] }> {
  return smartToolRegistry.init()
}

export function getSmartTool(name: string): AnySmartTool | undefined {
  return smartToolRegistry.get(name)
}

export async function executeSmartTool(
  name: string,
  params: Record<string, unknown>,
  context: SmartToolContext
): Promise<SmartToolResult> {
  return smartToolRegistry.execute(name, params, context)
}

export function getSmartToolNames(): string[] {
  return smartToolRegistry.getNames()
}

export function getAllSmartTools(): AnySmartTool[] {
  return smartToolRegistry.getAll()
}

export function getSmartToolDescriptions(): Record<string, string> {
  return smartToolRegistry.getDescriptions()
}

export function getSmartToolSchemas() {
  return smartToolRegistry.getSchemas()
}

export function isUserSmartTool(name: string): boolean {
  return smartToolRegistry.isUserDefined(name)
}

// Export the registry instance for direct access if needed
export { smartToolRegistry }

// =============================================================================
// Legacy aliases for backward compatibility
// =============================================================================

/** @deprecated Use initSmartToolRegistry */
export const initAgentRegistry = initSmartToolRegistry
/** @deprecated Use getSmartTool */
export const getAgent = getSmartTool
/** @deprecated Use executeSmartTool */
export const executeAgent = executeSmartTool
/** @deprecated Use getSmartToolNames */
export const getAgentNames = getSmartToolNames
/** @deprecated Use getAllSmartTools */
export const getAllAgents = getAllSmartTools
/** @deprecated Use getSmartToolDescriptions */
export const getAgentDescriptions = getSmartToolDescriptions
/** @deprecated Use getSmartToolSchemas */
export const getAgentSchemas = getSmartToolSchemas
/** @deprecated Use isUserSmartTool */
export const isUserAgent = isUserSmartTool
/** @deprecated Use smartToolRegistry */
export const agentRegistry = smartToolRegistry
