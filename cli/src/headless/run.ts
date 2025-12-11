/**
 * Headless execution engine for sonder
 * Runs chat completions with tool calling without TUI
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { streamChat, type Message, type ToolCallRequest } from '../services/openrouter'
import { executeTool } from '../tools/registry'
import { MODEL_IDS, type ModelName } from '../constants/app-constants'
import type { HeadlessConfig } from '../config/scope'

export interface ToolCallRecord {
  name: string
  args: Record<string, unknown>
  result: string
  success: boolean
}

export interface HeadlessResult {
  success: boolean
  response: string
  toolCalls: ToolCallRecord[]
  error?: string
  duration: number
  tokensUsed: {
    input: number
    output: number
    total: number
  }
}

const DEFAULT_SYSTEM_PROMPT = `You are sonder, an AI assistant running in headless/CI mode.
You have access to tools for file operations, code search, and shell commands.
Execute tasks efficiently and provide clear, structured output.`

/**
 * Load system prompt from sonder.md or use default
 */
function loadSystemPrompt(): string {
  // Look for sonder.md in project root (3 levels up from headless/)
  const projectRoot = join(__dirname, '..', '..', '..', '..')
  const systemPromptPath = join(projectRoot, 'sonder.md')

  if (existsSync(systemPromptPath)) {
    try {
      const content = readFileSync(systemPromptPath, 'utf-8').trim()
      if (content) return content
    } catch {
      // Fall through to default
    }
  }

  return DEFAULT_SYSTEM_PROMPT
}

/**
 * Run sonder in headless mode
 * Executes a single prompt with tool calling loop until completion
 */
export async function runHeadless(config: HeadlessConfig): Promise<HeadlessResult> {
  const startTime = Date.now()
  const toolCallRecords: ToolCallRecord[] = []

  // Resolve model name to actual API model ID
  let model = MODEL_IDS.sonder // Default
  if (config.model) {
    // Check if it's a known model name (e.g., 'sonder', 'claude', 'gemini')
    if (config.model in MODEL_IDS) {
      model = MODEL_IDS[config.model as ModelName]
    } else {
      // Assume it's already a full model ID (e.g., 'anthropic/claude-3.7-sonnet')
      model = config.model
    }
  }
  const timeout = config.timeout || 300000 // 5 min default

  // Setup abort controller for timeout
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), timeout)

  try {
    // Build initial messages
    const systemPrompt = loadSystemPrompt()
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: config.prompt },
    ]

    let finalResponse = ''
    let totalInputTokens = 0
    let totalOutputTokens = 0

    // Tool calling loop
    let continueLoop = true
    while (continueLoop) {
      if (abortController.signal.aborted) {
        throw new Error('Execution timed out')
      }

      const result = await streamChat(
        messages,
        {
          onChunk: () => {}, // No streaming output in headless
          onToolCall: () => {},
        },
        model,
        abortController.signal
      )

      totalOutputTokens += result.completionTokens

      // If there are tool calls, execute them and continue
      if (result.toolCalls.length > 0) {
        // Add assistant message if there was any text
        if (result.text) {
          messages.push({
            role: 'assistant',
            content: result.text,
          })
        }

        // Execute each tool call and add results as user messages
        // (matching the pattern used in use-chat-handler.ts)
        for (const toolCall of result.toolCalls) {
          const toolResult = await executeTool(toolCall.name, toolCall.args)

          toolCallRecords.push({
            name: toolCall.name,
            args: toolCall.args,
            result: toolResult.fullResult || toolResult.summary,
            success: toolResult.success,
          })

          // Add tool result as user message (same pattern as interactive mode)
          messages.push({
            role: 'user',
            content: `[Tool Result for ${toolCall.name}]\n${toolResult.fullResult || toolResult.summary}\n\nNow continue based on these results.`,
          })
        }
      } else {
        // No tool calls, we have our final response
        finalResponse = result.text
        continueLoop = false
      }
    }

    clearTimeout(timeoutId)

    return {
      success: true,
      response: finalResponse,
      toolCalls: toolCallRecords,
      duration: (Date.now() - startTime) / 1000,
      tokensUsed: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
      },
    }
  } catch (error) {
    clearTimeout(timeoutId)

    return {
      success: false,
      response: '',
      toolCalls: toolCallRecords,
      error: error instanceof Error ? error.message : String(error),
      duration: (Date.now() - startTime) / 1000,
      tokensUsed: {
        input: 0,
        output: 0,
        total: 0,
      },
    }
  }
}
