import type { AgentContext, AgentResult, AgentDefinition } from './types'
import { loadUserAgents } from '../utils/user-loader'

// Import all built-in agents here
import { planAgent } from './plan-agent'
import { explorerAgent } from './explorer-agent'
import { researcherWebAgent } from './researcher-web-agent'
import { codeReviewerAgent } from './code-reviewer-agent'
import { contextPrunerAgent } from './context-pruner-agent'
import { interrogatorAgent } from './interrogator-agent'
import { bestOfNAgent } from './best-of-n-agent'
import { hackerAgent } from './hacker-agent'

// Pentesting agents
import { nmapAgent } from './nmap-agent'
import { gobusterAgent } from './gobuster-agent'
import { searchsploitAgent } from './searchsploit-agent'
import { niktoAgent } from './nikto-agent'
import { hydraAgent } from './hydra-agent'

// Using loose type to avoid complex generic variance issues
type AnyAgentDefinition = AgentDefinition<any, any>

/**
 * Built-in agents (always available)
 */
const builtInAgents: AnyAgentDefinition[] = [
  planAgent,
  explorerAgent,
  researcherWebAgent,
  codeReviewerAgent,
  contextPrunerAgent,
  interrogatorAgent,
  bestOfNAgent,
  hackerAgent,
  // Pentesting agents
  nmapAgent,
  gobusterAgent,
  searchsploitAgent,
  niktoAgent,
  hydraAgent,
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
 * Check if an agent is user-defined
 */
export function isUserAgent(name: string): boolean {
  return !builtInAgents.some(a => a.name === name) && agentMap.has(name)
}
