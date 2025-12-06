import { z } from 'zod'
import type { Logger } from '../utils/logger'

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

// ============================================================================
// Generator-based Agent Architecture (Codebuff pattern)
// ============================================================================

/**
 * Tool call yielded from handleSteps generator
 */
export interface AgentToolCall {
  toolName: string
  input: Record<string, unknown>
  /** Set to false to hide this tool call from message history */
  includeToolCall?: boolean
}

/**
 * Context passed to handleSteps generator
 */
export interface AgentStepContext {
  params: Record<string, unknown>
  prompt?: string
  agentState: AgentState
  /** Logger instance for structured agent logging */
  logger: Logger
}

/**
 * Subgoal for tracking agent progress
 */
export interface AgentSubgoal {
  id: string
  objective: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  plan?: string
  logs: string[]
}

/**
 * Agent state accessible during step execution
 */
export interface AgentState {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  toolResults: unknown[]
  /** Explicit output set via set_output tool */
  output?: Record<string, unknown>
  /** Subgoals for tracking progress */
  subgoals: Record<string, AgentSubgoal>
}

/**
 * Result passed back to generator after each yield
 */
export interface StepResult {
  agentState: AgentState
  toolResult?: unknown
  stepsComplete: boolean
  /** Responses from GenerateN yield */
  nResponses?: string[]
}

/**
 * Output modes for agent responses
 */
export type AgentOutputMode = 'last_message' | 'all_messages' | 'structured_output'

/**
 * StepText yield type - injects text directly into assistant messages
 */
export type StepText = { type: 'STEP_TEXT'; text: string }

/**
 * GenerateN yield type - generate N parallel LLM responses for multi-arm exploration
 */
export type GenerateN = { type: 'GENERATE_N'; n: number }

/**
 * Input schema for structured agent params
 */
export interface AgentInputSchema {
  prompt?: { type: 'string'; description: string }
  params?: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
}

/**
 * Extended agent definition with generator-based step control
 * Compatible with codebuff's agent architecture
 */
export interface GeneratorAgentDefinition<
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown
> {
  // Identity
  name: string
  id?: string
  description: string

  // Model configuration
  model?: string

  // Discovery
  spawnerPrompt?: string
  inputSchema?: AgentInputSchema

  // Output control
  outputMode?: AgentOutputMode
  outputSchema?: Record<string, unknown>

  // Tool/agent access
  toolNames?: string[]
  spawnableAgents?: string[]

  // Prompts
  systemPrompt: string
  instructionsPrompt?: string
  /** Prompt inserted at each agent step, wrapped in <system_reminder> */
  stepPrompt?: string

  // Parameters
  parameters: TParams

  // Execution - generator-based
  handleSteps: (
    ctx: AgentStepContext
  ) => Generator<AgentToolCall | StepText | GenerateN | 'STEP' | 'STEP_ALL', void, StepResult>
}

/**
 * Union type for any agent definition
 */
export type AnyAgentDefinition<
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown
> = AgentDefinition<TParams, TResult> | GeneratorAgentDefinition<TParams, TResult>

/**
 * Type guard to check if agent uses generator pattern
 */
export function isGeneratorAgent(
  agent: AnyAgentDefinition
): agent is GeneratorAgentDefinition {
  return 'handleSteps' in agent && typeof agent.handleSteps === 'function'
}

/**
 * Helper to create generator-based agent definitions
 */
export function defineGeneratorAgent<TParams extends z.ZodType, TResult = unknown>(
  config: GeneratorAgentDefinition<TParams, TResult>
): GeneratorAgentDefinition<TParams, TResult> {
  return config
}
