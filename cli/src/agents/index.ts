/**
 * Agents Module
 *
 * Self-contained AI agents that perform specialized tasks.
 *
 * ## Creating a new agent
 *
 * ```typescript
 * import { defineAgent } from './types'
 * import { z } from 'zod'
 *
 * export const myAgent = defineAgent({
 *   name: 'my-agent',
 *   description: 'What this agent does',
 *   systemPrompt: 'You are...',
 *   parameters: z.object({
 *     target: z.string(),
 *   }),
 *   async execute(params, context) {
 *     // Your logic
 *     return { success: true, summary: '...', data: {} }
 *   },
 * })
 * ```
 *
 * Then register it in `registry.ts`.
 */

// Registry - agent discovery and execution
export {
  executeAgent,
  getAgent,
  getAgentNames,
  getAgentDescriptions,
  getAgentSchemas,
  initAgentRegistry,
} from './registry'
export type { AgentName } from './registry'

// Types - for creating new agents
export type { AgentResult, AgentContext, AgentDefinition } from './types'
export { defineAgent } from './types'
export { defineSimpleAgent } from './simple-agent'
export type { SimpleAgentConfig, JsonSchema, JsonSchemaProperty } from './simple-agent'

// Built-in agents
// Note: council and mcp agents removed - agents now callable as tools directly
export { bestOfNAgent } from './best-of-n-agent'
export { reviewerAgent } from './reviewer-agent'
export { commanderAgent } from './commander-agent'
export { editorAgent } from './editor-agent'
export { exploreAgent } from './explore-agent'
export { searchFetchAgent } from './researcher-web-agent'
export { compactAgent } from './context-pruner-agent'
export { interrogatorAgent } from './interrogator-agent'
export { hinterAgent } from './hinter-agent'
export { reconAgent } from './recon-agent'
export { cryptoAgent } from './crypto-agent'
export { reverseAgent } from './reverse-agent'
export { seAgent } from './se-agent'
export { vgrepAgent } from './vgrep-agent'
export { vglobAgent } from './vglob-agent'
