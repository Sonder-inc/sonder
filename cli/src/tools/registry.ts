import { tool } from 'ai'
import type { ToolResult, ToolDefinition } from './types'
import { loadUserTools } from '../utils/user-loader'

// Import all built-in tools here
import { planWrite, todoStrike, taskComplete } from './plan-write'
import { addSubgoal, updateSubgoal, strikeSubgoal, clearSubgoals } from './subgoal'
import { flashGrep } from './flash-grep'
import { explore } from './explore'
import { spawnAgent } from './spawn-agent'
import { status } from './status'
import { runTerminalCommand } from './run-terminal-command'
import { runReconScans } from './run-recon-scans'
import { runVulnSearch, runExploitMatch } from './run-vuln-search'

// Using loose array type to avoid complex generic variance issues
type AnyToolDefinition = ToolDefinition<any>

/**
 * Built-in tools (always available)
 */
const builtInTools: AnyToolDefinition[] = [
  // Subgoal tracking (replaces plan)
  addSubgoal,
  updateSubgoal,
  strikeSubgoal,
  clearSubgoals,
  // Legacy plan tools (deprecated, kept for compatibility)
  planWrite,
  todoStrike,
  taskComplete,
  // Core tools
  flashGrep,
  explore,
  spawnAgent,
  status,
  runTerminalCommand,
  runReconScans,
  runVulnSearch,
  runExploitMatch,
]

// Runtime registry (populated on init)
let allTools: AnyToolDefinition[] = [...builtInTools]
let toolMap = new Map(allTools.map(t => [t.name, t] as const))
let _availableTools: Record<string, ReturnType<typeof tool>> = {}

/**
 * Initialize tool registry, loading user tools from ~/.sonder/tools/
 */
export async function initToolRegistry(): Promise<{ loaded: number; names: string[] }> {
  const userTools = await loadUserTools()

  // Merge built-in and user tools (user tools can override built-in)
  const toolsByName = new Map<string, AnyToolDefinition>()
  for (const t of builtInTools) {
    toolsByName.set(t.name, t)
  }
  for (const t of userTools) {
    toolsByName.set(t.name, t)
  }

  allTools = Array.from(toolsByName.values())
  toolMap = new Map(allTools.map(t => [t.name, t] as const))

  // Rebuild available tools for AI SDK
  _availableTools = Object.fromEntries(
    allTools.map(t => [
      t.name,
      tool({
        description: t.description,
        inputSchema: t.parameters as any,
      }),
    ])
  )

  return {
    loaded: userTools.length,
    names: userTools.map(t => t.name),
  }
}

/**
 * Available tools in Vercel AI SDK format
 * Used by openrouter.ts for streamText()
 */
export function getAvailableTools(): Record<string, ReturnType<typeof tool>> {
  // Return cached or build from current allTools
  if (Object.keys(_availableTools).length === 0) {
    _availableTools = Object.fromEntries(
      allTools.map(t => [
        t.name,
        tool({
          description: t.description,
          inputSchema: t.parameters as any,
        }),
      ])
    )
  }
  return _availableTools
}

// Legacy export for backwards compatibility
export const availableTools = getAvailableTools()

/**
 * Execute a tool by name with automatic parameter validation
 */
export async function executeTool(
  name: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  const t = toolMap.get(name)

  if (!t) {
    return {
      success: false,
      summary: `Unknown tool: ${name}`,
      fullResult: `No executor found for tool "${name}"`,
    }
  }

  // Validate parameters using Zod schema
  const parsed = t.parameters.safeParse(params)
  if (!parsed.success) {
    return {
      success: false,
      summary: 'Invalid parameters',
      fullResult: `Validation error: ${parsed.error.message}`,
    }
  }

  return t.execute(parsed.data as never)
}

/**
 * Get all available tool names
 */
export function getToolNames(): string[] {
  return allTools.map(t => t.name)
}

/**
 * Get tool descriptions for LLM context
 */
export function getToolDescriptions(): Record<string, string> {
  return Object.fromEntries(allTools.map(t => [t.name, t.description]))
}

/**
 * Check if a tool is user-defined
 */
export function isUserTool(name: string): boolean {
  return !builtInTools.some(t => t.name === name) && toolMap.has(name)
}
