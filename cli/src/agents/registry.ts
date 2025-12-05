import type { AgentContext, AgentResult } from './types'

// Import all agents here
import { planAgent } from './plan-agent'

/**
 * All registered agents
 * To add a new agent: import it above and add to this array
 */
const allAgents = [
  planAgent,
]

// Derive agent names from array
export type AgentName = typeof allAgents[number]['name']

// Build lookup map
const agentMap = new Map(
  allAgents.map(agent => [agent.name, agent] as const)
)

/**
 * Get agent definition by name
 */
export function getAgent(name: string) {
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

  return agent.execute(parsed.data, context)
}

/**
 * Get all agent names
 */
export function getAgentNames(): AgentName[] {
  return allAgents.map(a => a.name) as AgentName[]
}

/**
 * Get agent descriptions for main agent to know what's available
 */
export function getAgentDescriptions(): Record<string, string> {
  return Object.fromEntries(
    allAgents.map(a => [a.name, a.description])
  )
}
