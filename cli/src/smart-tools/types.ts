import { z } from 'zod'
import type { Logger } from '../utils/logger'

/**
 * Result returned by smart tool execution
 */
export interface SmartToolResult<T = unknown> {
  success: boolean
  summary: string
  data?: T
}

/**
 * Context passed to smart tool from main agent
 */
export interface SmartToolContext {
  /** Recent conversation snippet (trimmed for relevance) */
  conversationContext: string
  /** Current user request/goal */
  userIntent?: string
}

/**
 * Simple smart tool definition with system prompt and executor
 */
export interface SmartToolDefinition<
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown
> {
  name: string
  description: string
  /** Focused system prompt for this smart tool (< 500 tokens ideal) */
  systemPrompt: string
  /** Zod schema for structured params from main agent */
  parameters: TParams
  /** Execute the smart tool's task */
  execute: (
    params: z.infer<TParams>,
    context: SmartToolContext
  ) => Promise<SmartToolResult<TResult>>
}

/**
 * Helper to create type-safe smart tool definitions
 */
export function defineSmartTool<TParams extends z.ZodType, TResult = unknown>(
  config: SmartToolDefinition<TParams, TResult>
): SmartToolDefinition<TParams, TResult> {
  return config
}

// ============================================================================
// Generator-based Smart Tool Architecture (LLM loop via steps)
// ============================================================================

/**
 * Tool call yielded from handleSteps generator
 */
export interface SmartToolCall {
  toolName: string
  input: Record<string, unknown>
  /** Set to false to hide this tool call from message history */
  includeToolCall?: boolean
}

/**
 * Context passed to handleSteps generator
 */
export interface StepContext {
  params: Record<string, unknown>
  prompt?: string
  state: SmartToolState
  /** Logger instance for structured logging */
  logger: Logger
}

/**
 * Subgoal for tracking progress
 */
export interface Subgoal {
  id: string
  objective: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  plan?: string
  logs: string[]
}

/**
 * Smart tool state accessible during step execution
 */
export interface SmartToolState {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  toolResults: unknown[]
  /** Explicit output set via set_output tool */
  output?: Record<string, unknown>
  /** Subgoals for tracking progress */
  subgoals: Record<string, Subgoal>
}

/**
 * Result passed back to generator after each yield
 */
export interface StepResult {
  state: SmartToolState
  toolResult?: unknown
  stepsComplete: boolean
  /** Responses from GenerateN yield */
  nResponses?: string[]
}

/**
 * Output modes for smart tool responses
 */
export type OutputMode = 'last_message' | 'all_messages' | 'structured_output'

/**
 * StepText yield type - injects text directly into assistant messages
 */
export type StepText = { type: 'STEP_TEXT'; text: string }

/**
 * GenerateN yield type - generate N parallel LLM responses for multi-arm exploration
 */
export type GenerateN = { type: 'GENERATE_N'; n: number }

/**
 * Input schema for structured params
 */
export interface InputSchema {
  prompt?: { type: 'string'; description: string }
  params?: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
}

/**
 * Generator-based smart tool definition with LLM loop control
 */
export interface GeneratorSmartToolDefinition<
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
  inputSchema?: InputSchema

  // Output control
  outputMode?: OutputMode
  outputSchema?: Record<string, unknown>

  // Tool access
  toolNames?: string[]
  spawnableSmartTools?: string[]

  // Prompts
  systemPrompt: string
  instructionsPrompt?: string
  /** Prompt inserted at each step, wrapped in <system_reminder> */
  stepPrompt?: string

  // Parameters
  parameters: TParams

  // Execution - generator-based LLM loop
  handleSteps: (
    ctx: StepContext
  ) => Generator<SmartToolCall | StepText | GenerateN | 'STEP' | 'STEP_ALL', void, StepResult>
}

/**
 * Union type for any smart tool definition
 */
export type AnySmartToolDefinition<
  TParams extends z.ZodType = z.ZodType,
  TResult = unknown
> = SmartToolDefinition<TParams, TResult> | GeneratorSmartToolDefinition<TParams, TResult>

/**
 * Type guard to check if smart tool uses generator pattern
 */
export function isGeneratorSmartTool(
  smartTool: AnySmartToolDefinition
): smartTool is GeneratorSmartToolDefinition {
  return 'handleSteps' in smartTool && typeof smartTool.handleSteps === 'function'
}

/**
 * Helper to create generator-based smart tool definitions
 */
export function defineGeneratorSmartTool<TParams extends z.ZodType, TResult = unknown>(
  config: GeneratorSmartToolDefinition<TParams, TResult>
): GeneratorSmartToolDefinition<TParams, TResult> {
  return config
}

// ============================================================================
// Legacy aliases for backward compatibility during migration
// ============================================================================

/** @deprecated Use SmartToolResult */
export type AgentResult<T = unknown> = SmartToolResult<T>
/** @deprecated Use SmartToolContext */
export type AgentContext = SmartToolContext
/** @deprecated Use SmartToolDefinition */
export type AgentDefinition<TParams extends z.ZodType = z.ZodType, TResult = unknown> = SmartToolDefinition<TParams, TResult>
/** @deprecated Use defineSmartTool */
export const defineAgent = defineSmartTool
/** @deprecated Use SmartToolCall */
export type AgentToolCall = SmartToolCall
/** @deprecated Use StepContext */
export type AgentStepContext = StepContext
/** @deprecated Use Subgoal */
export type AgentSubgoal = Subgoal
/** @deprecated Use SmartToolState */
export type AgentState = SmartToolState
/** @deprecated Use OutputMode */
export type AgentOutputMode = OutputMode
/** @deprecated Use InputSchema */
export type AgentInputSchema = InputSchema
/** @deprecated Use GeneratorSmartToolDefinition */
export type GeneratorAgentDefinition<TParams extends z.ZodType = z.ZodType, TResult = unknown> = GeneratorSmartToolDefinition<TParams, TResult>
/** @deprecated Use AnySmartToolDefinition */
export type AnyAgentDefinition<TParams extends z.ZodType = z.ZodType, TResult = unknown> = AnySmartToolDefinition<TParams, TResult>
/** @deprecated Use isGeneratorSmartTool */
export const isGeneratorAgent = isGeneratorSmartTool
/** @deprecated Use defineGeneratorSmartTool */
export const defineGeneratorAgent = defineGeneratorSmartTool
