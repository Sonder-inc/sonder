import { tool } from 'ai'
import type { ToolResult } from './types'

// Import all tools here - adding a new tool = import + add to allTools array
import { searchOnline } from './search-online'
import { planWrite } from './plan-write'

/**
 * All registered tools
 * To add a new tool: import it above and add to this array
 */
const allTools = [
  searchOnline,
  planWrite,
]

// Derive tool names automatically from the array
export type ToolName = typeof allTools[number]['name']

// Build lookup map for execution
const toolMap = new Map(
  allTools.map(tool => [tool.name, tool] as const)
)

/**
 * Available tools in Vercel AI SDK format
 * Used by openrouter.ts for streamText()
 */
export const availableTools: Record<string, ReturnType<typeof tool>> = Object.fromEntries(
  allTools.map(t => [
    t.name,
    tool({
      description: t.description,
      inputSchema: t.parameters as any,
    }),
  ])
)

/**
 * Execute a tool by name with automatic parameter validation
 */
export async function executeTool(
  name: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  const tool = toolMap.get(name)

  if (!tool) {
    return {
      success: false,
      summary: `Unknown tool: ${name}`,
      fullResult: `No executor found for tool "${name}"`,
    }
  }

  // Validate parameters using Zod schema
  const parsed = tool.parameters.safeParse(params)
  if (!parsed.success) {
    return {
      success: false,
      summary: 'Invalid parameters',
      fullResult: `Validation error: ${parsed.error.message}`,
    }
  }

  return tool.execute(parsed.data as never)
}

/**
 * Get all available tool names
 */
export function getToolNames(): ToolName[] {
  return allTools.map(t => t.name) as ToolName[]
}
