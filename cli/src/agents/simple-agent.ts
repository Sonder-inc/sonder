/**
 * Simple Agent Factory
 *
 * Creates single-step structured output agents that just run one LLM call.
 * Use for agents that analyze input and return structured JSON without tool calls.
 *
 * Examples: hinter, crypto, reverse, se, interrogator
 */

import { defineGeneratorAgent, type GeneratorAgentDefinition } from './types'
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
 * Simple JSON Schema for agent parameters
 */
export interface JsonSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required?: string[]
}

/**
 * Configuration for a simple structured output agent
 */
export interface SimpleAgentConfig<TResult> {
  /** Agent name (used for registration and invocation) */
  name: string
  /** Short description of what the agent does */
  description: string
  /** Prompt shown to spawner agent explaining when to use this agent */
  spawnerPrompt: string
  /** System prompt defining the agent's role and output format */
  systemPrompt: string
  /** JSON schema for input parameters */
  parameters: JsonSchema
  /** Model to use (defaults to claude-3.5-haiku) */
  model?: string
}

/**
 * Creates a simple single-step structured output agent.
 *
 * These agents:
 * - Take structured input parameters
 * - Run one LLM call with the system prompt
 * - Return structured JSON output
 * - Don't use any tools
 *
 * @example
 * ```typescript
 * const myAgent = defineSimpleAgent<MyResult>({
 *   name: 'my-agent',
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
export function defineSimpleAgent<TResult>(
  config: SimpleAgentConfig<TResult>
): GeneratorAgentDefinition<any, TResult> {
  const zodSchema = jsonSchemaToZod(config.parameters)

  return defineGeneratorAgent({
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
