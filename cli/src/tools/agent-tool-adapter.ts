import type { AnyAgentDefinition, AgentContext } from '../agents/types'
import { isGeneratorAgent } from '../agents/types'
import { executeAgent } from '../agents/registry'
import type { ToolDefinition, ToolResult } from './types'

/**
 * Convert an agent definition to a tool definition
 * This allows agents to be called directly as tools from the main agent
 */
export function agentToTool(agent: AnyAgentDefinition): ToolDefinition {
  // Use spawnerPrompt for generator agents, or description for legacy agents
  const description = isGeneratorAgent(agent)
    ? agent.spawnerPrompt || agent.description
    : agent.description

  return {
    name: agent.name,
    description,
    parameters: agent.parameters,
    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      // Build agent context from params
      const context: AgentContext = {
        conversationContext: (params.context as string) || '',
        userIntent: (params.task as string) || (params.prompt as string) || '',
      }

      try {
        const result = await executeAgent(agent.name, params, context)

        return {
          success: result.success,
          summary: result.summary,
          fullResult: result.data
            ? JSON.stringify(result.data, null, 2)
            : result.summary,
          displayName: agent.name,
          displayColor: result.success ? 'success' : 'error',
        }
      } catch (error) {
        return {
          success: false,
          summary: `Agent ${agent.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          fullResult: error instanceof Error ? error.stack || error.message : 'Unknown error',
          displayName: agent.name,
          displayColor: 'error',
        }
      }
    },
  }
}

/**
 * Agents that should not be exposed as tools
 * - council: removed entirely per user decision
 * - mcp: being removed, MCP tools will be in unified registry
 * - explore: internal tool, not for main agent direct access
 */
const INTERNAL_AGENTS = new Set(['council', 'mcp', 'explore'])

/**
 * Check if an agent should be exposed as a tool
 */
export function shouldExposeAsTools(agent: AnyAgentDefinition): boolean {
  return !INTERNAL_AGENTS.has(agent.name)
}
