/**
 * Tools Module
 */

export {
  toolRegistry,
  executeTool,
  getToolNames,
  getToolDescriptions,
  initToolRegistry,
  getAvailableTools,
  isUserTool,
} from './registry'

export type { ToolResult, ToolDefinition } from './types'
export { defineTool } from './types'

// Built-in tools - File operations
export { Read, Write, Edit } from './file'

// Built-in tools - Shell execution
export { Bash } from './bash'

// Built-in tools - Search & explore
export { Glob } from './glob'
export { flashGrep } from './flash-grep'

// Built-in tools - Progress tracking
export { status } from './status'
export { addSubgoal, updateSubgoal, strikeSubgoal, clearSubgoals } from './subgoal'

// Built-in tools - Orchestration
export { batchTool } from './batch'
