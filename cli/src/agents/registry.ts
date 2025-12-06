import type { AgentContext, AgentResult, AgentDefinition } from './types'
import { loadUserAgents } from '../utils/user-loader'

// Import all built-in agents
import { councilAgent } from './council-agent'
import { bestOfNAgent } from './best-of-n-agent'
import { codeReviewerAgent } from './code-reviewer-agent'
import { commanderAgent } from './commander-agent'
import { editorAgent } from './editor-agent'
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
import { mcpAgent } from './mcp-agent'

// Using loose type to avoid complex generic variance issues
type AnyAgentDefinition = AgentDefinition<any, any>

/**
 * Built-in agents (always available)
 */
const builtInAgents: AnyAgentDefinition[] = [
  councilAgent,
  bestOfNAgent,
  codeReviewerAgent,
  commanderAgent,
  editorAgent,
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
  mcpAgent,
]

// Runtime registry (populated on init)
let allAgents: AnyAgentDefinition[] = [...builtInAgents]
let agentMap = new Map(allAgents.map(a => [a.name, a] as const))

/**
 * Initialize agent registry, loading user agents from ~/.sonder/agents/
 */
export async function initAgentRegistry(): Promise<{ loaded: number; names: string[] }> {
  const userAgents = await loadUserAgents()

  // Merge built-in and user agents (user agents can override built-in)
  const agentsByName = new Map<string, AnyAgentDefinition>()
  for (const a of builtInAgents) {
    agentsByName.set(a.name, a)
  }
  for (const a of userAgents) {
    agentsByName.set(a.name, a)
  }

  allAgents = Array.from(agentsByName.values())
  agentMap = new Map(allAgents.map(a => [a.name, a] as const))

  return {
    loaded: userAgents.length,
    names: userAgents.map(a => a.name),
  }
}

export type AgentName = string

/**
 * Get agent definition by name
 */
export function getAgent(name: string): AgentDefinition | undefined {
  return agentMap.get(name)
}

/**
 * Execute an agent by name
 */
export async function executeAgent(
  name: string,
  params: Record<string, unknown>,
  context: AgentContext
): Promise<AgentResult> {
  const agent = agentMap.get(name)

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

  return agent.execute(parsed.data as never, context)
}

/**
 * Get all agent names
 */
export function getAgentNames(): string[] {
  return allAgents.map(a => a.name)
}

/**
 * Get agent descriptions for main agent to know what's available
 */
export function getAgentDescriptions(): Record<string, string> {
  return Object.fromEntries(allAgents.map(a => [a.name, a.description]))
}

/**
 * Get rich agent info including parameter schemas for internal negotiation
 */
export function getAgentSchemas(): Record<string, { description: string; params: Record<string, string> }> {
  const result: Record<string, { description: string; params: Record<string, string> }> = {}

  for (const agent of allAgents) {
    if (agent.name === 'council') continue // Skip internal agent

    // Extract param descriptions from zod schema
    const params: Record<string, string> = {}
    const shape = (agent.parameters as any)?._def?.shape?.()

    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        const desc = (value as any)?._def?.description || (value as any)?.description
        const typeName = (value as any)?._def?.typeName || 'unknown'
        params[key] = desc || typeName
      }
    }

    result[agent.name] = {
      description: agent.description,
      params,
    }
  }

  return result
}

/**
 * Check if an agent is user-defined
 */
export function isUserAgent(name: string): boolean {
  return !builtInAgents.some(a => a.name === name) && agentMap.has(name)
}
