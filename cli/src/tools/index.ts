import { searchOnline, searchOnlineSchema } from './search-online'

export type ToolName = 'search_online'

export interface ToolDefinition {
  name: ToolName
  description: string
  parameters: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  summary: string
  fullResult: string
}

// Tool schemas for the AI (OpenAI function calling format)
export const toolSchemas = [searchOnlineSchema]

// Tool executors
const toolExecutors: Record<ToolName, (params: Record<string, unknown>) => Promise<ToolResult>> = {
  search_online: searchOnline,
}

export async function executeTool(name: ToolName, params: Record<string, unknown>): Promise<ToolResult> {
  const executor = toolExecutors[name]
  if (!executor) {
    return {
      success: false,
      summary: `Unknown tool: ${name}`,
      fullResult: `No executor found for tool "${name}"`,
    }
  }
  return executor(params)
}

export { searchOnline, searchOnlineSchema }
