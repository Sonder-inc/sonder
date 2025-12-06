import { z } from 'zod'

/**
 * File change stats for tracking additions/changes/deletions
 */
export interface FileChangeStats {
  additions: number // Lines added
  deletions: number // Lines deleted
  changes: number // Files modified
}

/**
 * Result returned by tool execution
 */
export interface ToolResult {
  success: boolean
  summary: string
  fullResult: string
  fileStats?: FileChangeStats // Optional file change tracking
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
