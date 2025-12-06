/**
 * Tools Module
 *
 * Tools are functions the LLM can invoke during conversation.
 *
 * ## Creating a new tool
 *
 * ```typescript
 * import { defineTool } from './types'
 * import { z } from 'zod'
 *
 * export const myTool = defineTool({
 *   name: 'my_tool',
 *   description: 'What this tool does',
 *   parameters: z.object({
 *     query: z.string(),
 *   }),
 *   async execute(params) {
 *     // Your logic
 *     return { success: true, summary: '...', fullResult: {} }
 *   },
 * })
 * ```
 *
 * Then register it in `registry.ts`.
 */

// Registry - tool discovery and execution
export {
  executeTool,
  availableTools,
  getToolNames,
  getToolDescriptions,
  initToolRegistry,
} from './registry'

// Types - for creating new tools
export type { ToolResult, ToolDefinition } from './types'
export { defineTool } from './types'

// Built-in tools
export { planWrite } from './plan-write'
export { flashGrep } from './flash-grep'
export { explore } from './explore'
export { spawnAgent } from './spawn-agent'
