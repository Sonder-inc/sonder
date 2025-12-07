/**
 * Simple Smart Tool Factory
 *
 * Creates single-step structured output smart tools that just run one LLM call.
 * Use for smart tools that analyze input and return structured JSON without tool calls.
 *
 * Examples: hinter, crypto, reverse, se, interrogator
 */

import { defineGeneratorSmartTool, type GeneratorSmartToolDefinition } from './types'
import { jsonSchemaToZod } from '../tools/schema-converter'

/**
 * JSON Schema property definition
 */
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: string[]
  items?: { type: string }
  default?: unknown
}

/**
 * Simple JSON Schema for smart tool parameters
 */
export interface JsonSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required?: string[]
}

/**
 * Configuration for a simple structured output smart tool
 */
export interface SimpleSmartToolConfig<TResult> {
  /** Smart tool name (used for registration and invocation) */
  name: string
  /** Short description of what the smart tool does */
  description: string
  /** Prompt shown to spawner explaining when to use this smart tool */
  spawnerPrompt: string
  /** System prompt defining the smart tool's role and output format */
  systemPrompt: string
  /** JSON schema for input parameters */
  parameters: JsonSchema
  /** Model to use (defaults to claude-3.5-haiku) */
  model?: string
}

/**
 * Creates a simple single-step structured output smart tool.
 *
 * These smart tools:
 * - Take structured input parameters
 * - Run one LLM call with the system prompt
 * - Return structured JSON output
 * - Don't use any tools
 *
 * @example
 * ```typescript
 * const myTool = defineSimpleSmartTool<MyResult>({
 *   name: 'my-tool',
 *   description: 'Does something useful',
 *   spawnerPrompt: 'Use when you need...',
 *   systemPrompt: 'You are... Output JSON: {...}',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'The search query' },
 *       limit: { type: 'number', description: 'Max results', default: 10 },
 *     },
 *     required: ['query'],
 *   },
 * })
 * ```
 */
export function defineSimpleSmartTool<TResult>(
  config: SimpleSmartToolConfig<TResult>
): GeneratorSmartToolDefinition<any, TResult> {
  const zodSchema = jsonSchemaToZod(config.parameters)

  return defineGeneratorSmartTool({
    name: config.name,
    id: config.name,
    model: config.model ?? 'anthropic/claude-3.5-haiku',
    description: config.description,
    spawnerPrompt: config.spawnerPrompt,
    outputMode: 'structured_output',
    systemPrompt: config.systemPrompt,
    parameters: zodSchema,
    *handleSteps() {
      yield 'STEP'
    },
  })
}

/** @deprecated Use SimpleSmartToolConfig */
export type SimpleAgentConfig<TResult> = SimpleSmartToolConfig<TResult>

/** @deprecated Use defineSimpleSmartTool */
export const defineSimpleAgent = defineSimpleSmartTool
