import { tool } from 'ai'
import type { ToolResult, ToolDefinition } from './types'
import { loadUserTools } from '../utils/user-loader'

// Import existing built-in tools
import { addSubgoal, updateSubgoal, strikeSubgoal, clearSubgoals } from './subgoal'
import { flashGrep } from './flash-grep'
import { status } from './status'
import { Bash } from './bash'
import { batchTool } from './batch'
import { Read, Write, Edit } from './file'
import { Glob } from './glob'

// Smart tool adapter
import { smartToolToTool, shouldExposeAsTool } from './agent-tool-adapter'
import { getAllSmartTools } from '../smart-tools/registry'

type AnyToolDefinition = ToolDefinition<any>

/**
 * Built-in tools (always available to main agent)
 */
const builtInTools: AnyToolDefinition[] = [
  // File operations
  Read,
  Write,
  Edit,
  // Shell execution
  Bash,
  // Search & explore
  Glob,
  flashGrep,
  // Progress tracking
  addSubgoal,
  updateSubgoal,
  strikeSubgoal,
  clearSubgoals,
  status,
  // Orchestration
  batchTool,
]

/**
 * Internal tools (used by agents, not exposed to main agent)
 */
const internalTools: AnyToolDefinition[] = [
  // None currently - all tools are exposed to main agent
]

/**
 * Get smart tools exposed as regular tools
 */
function getSmartToolsAsTools(): AnyToolDefinition[] {
  const smartTools = getAllSmartTools()
  return smartTools
    .filter(shouldExposeAsTool)
    .map(smartToolToTool)
}

// Runtime registry
let exposedTools: AnyToolDefinition[] = [...builtInTools]  // Tools exposed to main agent
let toolMap = new Map<string, AnyToolDefinition>()          // All tools (for execution)
let _availableTools: Record<string, ReturnType<typeof tool>> = {}

/**
 * Initialize tool registry
 */
export async function initToolRegistry(): Promise<{ loaded: number; names: string[] }> {
  const userTools = await loadUserTools()
  const smartToolsAsTools = getSmartToolsAsTools()

  // Build exposed tools (main agent can see these)
  const exposedByName = new Map<string, AnyToolDefinition>()
  for (const t of builtInTools) {
    exposedByName.set(t.name, t)
  }
  for (const t of smartToolsAsTools) {
    exposedByName.set(t.name, t)
  }
  for (const t of userTools) {
    exposedByName.set(t.name, t)
  }
  exposedTools = Array.from(exposedByName.values())

  // Build full tool map (includes internal tools for agent use)
  toolMap = new Map(exposedByName)
  for (const t of internalTools) {
    toolMap.set(t.name, t)
  }

  // Build AI SDK tools (only exposed tools)
  _availableTools = Object.fromEntries(
    exposedTools.map(t => [
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
 * Get available tools in AI SDK format (only exposed tools)
 */
export function getAvailableTools(): Record<string, ReturnType<typeof tool>> {
  if (Object.keys(_availableTools).length === 0) {
    _availableTools = Object.fromEntries(
      exposedTools.map(t => [
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

/**
 * Execute a tool by name (can execute internal tools too)
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

export function getToolNames(): string[] {
  return exposedTools.map(t => t.name)
}

export function getToolDescriptions(): Record<string, string> {
  return Object.fromEntries(exposedTools.map(t => [t.name, t.description]))
}

export function isUserTool(name: string): boolean {
  return !builtInTools.some(t => t.name === name) && toolMap.has(name)
}

// Singleton-style registry object for compatibility
export const toolRegistry = {
  init: initToolRegistry,
  getAvailableTools,
  execute: executeTool,
  getToolNames,
  getToolDescriptions,
  get: (name: string) => toolMap.get(name),
  isUserTool,
  // MCP stubs (MCP tools not supported in simplified registry)
  registerMCPTools: (_serverName: string, _tools: unknown[]) => {},
  unregisterMCPTools: (_serverName: string) => {},
}
