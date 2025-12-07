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
  // UI display customization
  displayName?: string // Override tool name in UI (e.g., "Read" instead of "flash_grep")
  displayInput?: string // Clean input display (e.g., file path, pattern)
  displayMiddle?: string // Content between tool line and summary
  displayColor?: 'default' | 'success' | 'error' // Indicator color (default=white, success=green, error=red)
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

// =============================================================================
// Unified Tool Registry Types
// =============================================================================

/**
 * Source of a tool in the unified registry
 * - builtin: Core tools exposed to main agent
 * - internal: Tools only available to subagents (not exposed to main agent)
 * - user: User-defined tools from ~/.sonder/tools/
 * - mcp: Tools from MCP servers
 * - agent: Agents exposed as callable tools
 */
export type ToolSource = 'builtin' | 'internal' | 'user' | 'mcp' | 'agent'

/**
 * Registered tool with metadata about its source
 */
export interface RegisteredTool {
  definition: ToolDefinition
  source: ToolSource
  /** For MCP tools: which server provides this tool */
  mcpServer?: string
  /** For agent tools: original agent name */
  agentName?: string
}
