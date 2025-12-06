/**
 * Agent Parser Service
 *
 * Unified LLM output parsing for CLI tool agents.
 * Handles error fallbacks and JSON parsing with consistent patterns.
 */

import type { AgentContext, AgentResult } from '../agents/types'
import { executeAgentLLM } from './agent-executor'

export interface ParseToolOutputOptions<T> {
  /** Tool name for logging/errors */
  toolName: string
  /** System prompt for the LLM */
  systemPrompt: string
  /** Raw output from the CLI tool */
  rawOutput: string
  /** Agent context */
  context: AgentContext
  /** Empty result to return on failure */
  emptyResult: T
  /** Custom prompt prefix (default: "Parse this {toolName} output:") */
  promptPrefix?: string
  /** Build summary from parsed data */
  buildSummary: (data: T) => string
}

export interface ParseResult<T> {
  success: boolean
  data: T
  summary: string
}

/**
 * Parse CLI tool output using LLM with standardized error handling
 */
export async function parseToolOutput<T>(
  options: ParseToolOutputOptions<T>
): Promise<ParseResult<T>> {
  const {
    toolName,
    systemPrompt,
    rawOutput,
    context,
    emptyResult,
    promptPrefix,
    buildSummary,
  } = options

  const userPrompt = promptPrefix
    ? `${promptPrefix}\n\n${rawOutput}`
    : `Parse this ${toolName} output:\n\n${rawOutput}`

  const llmResult = await executeAgentLLM({
    name: toolName,
    systemPrompt,
    userPrompt,
    context,
  })

  if (!llmResult.success) {
    return {
      success: true,
      summary: `${capitalize(toolName)} complete (parse failed)`,
      data: { ...emptyResult, rawOutput },
    }
  }

  try {
    const parsed = JSON.parse(llmResult.text) as T
    const summary = buildSummary(parsed)

    return {
      success: true,
      summary,
      data: parsed,
    }
  } catch {
    return {
      success: true,
      summary: `${capitalize(toolName)} complete`,
      data: { ...emptyResult, rawOutput },
    }
  }
}

/**
 * Create an error result for when CLI tool execution fails
 */
export function createErrorResult<T>(
  toolName: string,
  error: string | undefined,
  emptyResult: T
): AgentResult<T> {
  return {
    success: false,
    summary: error || `${capitalize(toolName)} failed`,
    data: { ...emptyResult, rawOutput: error },
  }
}

/**
 * Build a summary with item count and truncated list
 */
export function buildItemSummary(
  items: { toString(): string }[],
  mapper: (item: unknown) => string,
  prefix: string,
  maxItems: number = 5
): string {
  if (items.length === 0) return ''

  const displayed = items.slice(0, maxItems).map(mapper).join(', ')
  const moreCount = items.length > maxItems ? ` +${items.length - maxItems} more` : ''

  return `${items.length} ${prefix}: ${displayed}${moreCount}`
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
