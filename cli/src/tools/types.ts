import { z } from 'zod'

/**
 * Result returned by tool execution
 */
export interface ToolResult {
  success: boolean
  summary: string
  fullResult: string
}

/**
 * Self-contained tool definition with schema and executor
 */
export interface ToolDefinition<TParams extends z.ZodType = z.ZodType> {
  name: string
  description: string
  parameters: TParams
  execute: (params: z.infer<TParams>) => Promise<ToolResult>
}

/**
 * Helper to create type-safe tool definitions with IDE autocomplete
 */
export function defineTool<TParams extends z.ZodType>(
  config: ToolDefinition<TParams>
): ToolDefinition<TParams> {
  return config
}
