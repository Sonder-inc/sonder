/**
 * Smart Tools Module
 *
 * Smart tools are tools with LLM loops (via generator steps).
 * They can call other tools, maintain state, and iterate.
 *
 * ## Creating a new smart tool
 *
 * ```typescript
 * import { defineSmartTool } from './types'
 * import { z } from 'zod'
 *
 * export const myTool = defineSmartTool({
 *   name: 'my-tool',
 *   description: 'What this tool does',
 *   systemPrompt: 'You are...',
 *   parameters: z.object({
 *     target: z.string(),
 *   }),
 *   async execute(params, context) {
 *     return { success: true, summary: '...', data: {} }
 *   },
 * })
 * ```
 *
 * Then register it in `registry.ts`.
 */

// Registry - smart tool discovery and execution
export {
  executeSmartTool,
  getSmartTool,
  getSmartToolNames,
  getSmartToolDescriptions,
  getSmartToolSchemas,
  initSmartToolRegistry,
  // Legacy aliases
  executeAgent,
  getAgent,
  getAgentNames,
  getAgentDescriptions,
  getAgentSchemas,
  initAgentRegistry,
} from './registry'

// Types - for creating new smart tools
export type {
  SmartToolResult,
  SmartToolContext,
  SmartToolDefinition,
  SmartToolCall,
  StepContext,
  SmartToolState,
  Subgoal,
  StepResult,
  OutputMode,
  InputSchema,
  GeneratorSmartToolDefinition,
  AnySmartToolDefinition,
  // Legacy aliases
  AgentResult,
  AgentContext,
  AgentDefinition,
} from './types'

export {
  defineSmartTool,
  defineGeneratorSmartTool,
  isGeneratorSmartTool,
  // Legacy aliases
  defineAgent,
  defineGeneratorAgent,
  isGeneratorAgent,
} from './types'

export { defineSimpleSmartTool } from './simple'
export type { SimpleSmartToolConfig, JsonSchema, JsonSchemaProperty } from './simple'

// Built-in smart tools
export { bestOfN } from './best-of-n'
export { reviewer } from './reviewer'
export { searchFetch } from './search-fetch'
export { compact } from './compact'
export { interrogator } from './interrogator'
export { hinter } from './hinter'
export { recon } from './recon'
export { crypto } from './crypto'
export { reverse } from './reverse'
export { se } from './se'
export { vgrep } from './vgrep'
export { vglob } from './vglob'
