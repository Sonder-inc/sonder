import { z } from 'zod'

/**
 * Result returned by agent execution
 */
export interface AgentResult<T = unknown> {
  success: boolean
  summary: string
  data?: T
}

/**
 * Context passed to subagent from main agent
 */
export interface AgentContext {
  /** Recent conversation snippet (trimmed for relevance) */
  conversationContext: string
  /** Current user request/goal */
  userIntent?: string
}

/**
 * Self-contained agent definition with system prompt and executor
 */
export interface AgentDefinition<
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown
> {
  name: string
  description: string
  /** Focused system prompt for this agent (< 500 tokens ideal) */
  systemPrompt: string
  /** Zod schema for structured params from main agent */
  parameters: TParams
  /** Execute the agent's task */
  execute: (
    params: z.infer<TParams>,
    context: AgentContext
  ) => Promise<AgentResult<TResult>>
}

/**
 * Helper to create type-safe agent definitions
 */
export function defineAgent<TParams extends z.ZodType, TResult = unknown>(
  config: AgentDefinition<TParams, TResult>
): AgentDefinition<TParams, TResult> {
  return config
}
