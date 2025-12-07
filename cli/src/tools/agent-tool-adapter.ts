import type { AnySmartToolDefinition, SmartToolContext } from '../smart-tools/types'
import { isGeneratorSmartTool } from '../smart-tools/types'
import { executeSmartTool } from '../smart-tools/registry'
import type { ToolDefinition, ToolResult } from './types'

/**
 * Convert a smart tool definition to a regular tool definition
 * This allows smart tools to be called directly as tools from the main agent
 */
export function smartToolToTool(smartTool: AnySmartToolDefinition): ToolDefinition {
  // Use spawnerPrompt for generator smart tools, or description for simple ones
  const description = isGeneratorSmartTool(smartTool)
    ? smartTool.spawnerPrompt || smartTool.description
    : smartTool.description

  return {
    name: smartTool.name,
    description,
    parameters: smartTool.parameters,
    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      // Build context from params
      const context: SmartToolContext = {
        conversationContext: (params.context as string) || '',
        userIntent: (params.task as string) || (params.prompt as string) || '',
      }

      try {
        const result = await executeSmartTool(smartTool.name, params, context)

        return {
          success: result.success,
          summary: result.summary,
          fullResult: result.data
            ? JSON.stringify(result.data, null, 2)
            : result.summary,
          displayName: smartTool.name,
          displayColor: result.success ? 'success' : 'error',
        }
      } catch (error) {
        return {
          success: false,
          summary: `Smart tool ${smartTool.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          fullResult: error instanceof Error ? error.stack || error.message : 'Unknown error',
          displayName: smartTool.name,
          displayColor: 'error',
        }
      }
    },
  }
}

/**
 * Check if a smart tool should be exposed as a regular tool
 * All smart tools are exposed by default
 */
export function shouldExposeAsTool(_smartTool: AnySmartToolDefinition): boolean {
  return true
}

/** @deprecated Use smartToolToTool */
export const agentToTool = smartToolToTool

/** @deprecated Use shouldExposeAsTool */
export const shouldExposeAsTools = shouldExposeAsTool
