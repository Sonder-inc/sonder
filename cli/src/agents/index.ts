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
  initAgentRegistry,
} from './registry'
export type { AgentName } from './registry'

// Types - for creating new agents
export type { AgentResult, AgentContext, AgentDefinition } from './types'
export { defineAgent } from './types'

// Built-in agents - exported for direct use
export { planAgent } from './plan-agent'
export { explorerAgent } from './explorer-agent'
export { hackerAgent } from './hacker-agent'
export { researcherWebAgent } from './researcher-web-agent'
export { codeReviewerAgent } from './code-reviewer-agent'
export { interrogatorAgent } from './interrogator-agent'
export { bestOfNAgent } from './best-of-n-agent'
export { contextPrunerAgent } from './context-pruner-agent'

// Pentesting agents
export { nmapAgent } from './nmap-agent'
export { gobusterAgent } from './gobuster-agent'
export { niktoAgent } from './nikto-agent'
export { hydraAgent } from './hydra-agent'
export { searchsploitAgent } from './searchsploit-agent'
