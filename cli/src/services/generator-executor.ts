/**
 * Generator Agent Executor
 *
 * Executes generator-based agents that use the handleSteps pattern.
 * Interprets yields for tool calls, STEP, and STEP_ALL.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { executeTool } from '../tools/registry'
import { createAgentLogger } from '../utils/logger'
import type {
  GeneratorSmartToolDefinition,
  SmartToolContext,
  SmartToolResult,
  SmartToolState,
  StepContext,
  StepResult,
  SmartToolCall,
  StepText,
  GenerateN,
  Subgoal,
} from '../smart-tools/types'

const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku'

export interface GeneratorExecutorConfig {
  smartTool: GeneratorSmartToolDefinition
  params: Record<string, unknown>
  prompt?: string
  context: SmartToolContext
}

/**
 * Execute a generator-based smart tool
 */
export async function executeGeneratorSmartTool(
  config: GeneratorExecutorConfig
): Promise<SmartToolResult> {
  const { smartTool, params, prompt, context } = config

  // Initialize state
  const state: SmartToolState = {
    messages: [],
    toolResults: [],
    subgoals: {},
  }

  // Add system prompt
  if (smartTool.systemPrompt) {
    state.messages.push({ role: 'system', content: smartTool.systemPrompt })
  }

  // Add instructions prompt
  if (smartTool.instructionsPrompt) {
    state.messages.push({ role: 'system', content: smartTool.instructionsPrompt })
  }

  // Add user context and prompt
  const userMessage = buildUserMessage(prompt, context)
  if (userMessage) {
    state.messages.push({ role: 'user', content: userMessage })
  }

  // Create smart tool-specific logger
  const logger = createAgentLogger(smartTool.name)

  // Create step context
  const stepContext: StepContext = {
    params,
    prompt,
    state,
    logger,
  }

  // Create and run generator
  const generator = smartTool.handleSteps(stepContext)

  let stepResult: StepResult = {
    state,
    toolResult: undefined,
    stepsComplete: false,
  }

  let iteration = generator.next(stepResult)

  while (!iteration.done) {
    const yieldValue = iteration.value

    if (yieldValue === 'STEP') {
      // Run single LLM inference step
      const llmResult = await runLLMStep(smartTool, state, context)
      state.messages.push({ role: 'assistant', content: llmResult })

      stepResult = {
        state,
        toolResult: llmResult,
        stepsComplete: false,
      }
    } else if (yieldValue === 'STEP_ALL') {
      // Run LLM steps until completion (no tool calls)
      let continueLoop = true
      let loopCount = 0
      const maxLoops = 10 // Safety limit

      while (continueLoop && loopCount < maxLoops) {
        const llmResult = await runLLMStep(smartTool, state, context)
        state.messages.push({ role: 'assistant', content: llmResult })
        loopCount++

        // Simple heuristic: if response is short or doesn't ask for tools, stop
        if (llmResult.length < 100 || !llmResult.includes('TOOL:')) {
          continueLoop = false
        }
      }

      stepResult = {
        state,
        toolResult: undefined,
        stepsComplete: true,
      }
    } else if (isStepText(yieldValue)) {
      // StepText: inject text directly into assistant messages
      state.messages.push({ role: 'assistant', content: yieldValue.text })

      stepResult = {
        state,
        toolResult: undefined,
        stepsComplete: false,
      }
    } else if (isGenerateN(yieldValue)) {
      // GenerateN: generate N parallel LLM responses for multi-arm exploration
      const n = yieldValue.n
      const responses = await Promise.all(
        Array.from({ length: n }, () => runLLMStep(smartTool, state, context))
      )

      stepResult = {
        state,
        toolResult: undefined,
        stepsComplete: false,
        nResponses: responses,
      }
    } else if (isToolCall(yieldValue)) {
      // Execute tool call
      const toolCall = yieldValue as SmartToolCall
      const excludeFromHistory = toolCall.includeToolCall === false

      // Handle special control tools
      if (toolCall.toolName === 'set_output') {
        // set_output: explicitly set output
        const input = toolCall.input as { data?: unknown }
        state.output = (input.data ?? input) as Record<string, unknown>

        const result = {
          success: true,
          summary: 'Output set',
          fullResult: 'Output has been set',
        }
        state.toolResults.push(result)

        stepResult = {
          state,
          toolResult: result,
          stepsComplete: false,
        }
      } else if (toolCall.toolName === 'add_message') {
        // add_message: add a message to the conversation
        const input = toolCall.input as { role: 'user' | 'assistant'; content: string }
        state.messages.push({
          role: input.role,
          content: input.content,
        })

        const result = {
          success: true,
          summary: 'Message added',
          fullResult: `Added ${input.role} message`,
        }
        state.toolResults.push(result)

        stepResult = {
          state,
          toolResult: result,
          stepsComplete: false,
        }
      } else if (toolCall.toolName === 'add_subgoal') {
        // add_subgoal: create a new subgoal (silent - no UI update for subagents)
        const input = toolCall.input as {
          id: string
          objective: string
          status?: 'pending' | 'in_progress' | 'completed' | 'blocked'
          plan?: string
          log?: string
        }

        const subgoal: Subgoal = {
          id: input.id,
          objective: input.objective,
          status: input.status || 'pending',
          plan: input.plan,
          logs: input.log ? [input.log] : [],
        }

        state.subgoals[input.id] = subgoal

        const result = {
          success: true,
          summary: `Subgoal added: ${input.objective.slice(0, 30)}`,
          fullResult: `Added subgoal "${input.id}": ${input.objective}`,
        }
        state.toolResults.push(result)

        stepResult = {
          state,
          toolResult: result,
          stepsComplete: false,
        }
      } else if (toolCall.toolName === 'update_subgoal') {
        // update_subgoal: update an existing subgoal (silent - no UI update for subagents)
        const input = toolCall.input as {
          id: string
          status?: 'pending' | 'in_progress' | 'completed' | 'blocked'
          plan?: string
          log?: string
        }

        const existing = state.subgoals[input.id]
        if (!existing) {
          // Create if doesn't exist
          state.subgoals[input.id] = {
            id: input.id,
            objective: input.id, // Use id as objective if not set
            status: input.status || 'pending',
            plan: input.plan,
            logs: input.log ? [input.log] : [],
          }
        } else {
          if (input.status) existing.status = input.status
          if (input.plan) existing.plan = input.plan
          if (input.log) existing.logs.push(input.log)
        }

        const result = {
          success: true,
          summary: `Subgoal updated: ${input.id}`,
          fullResult: `Updated subgoal "${input.id}"${input.status ? ` status=${input.status}` : ''}${input.log ? ` +log` : ''}`,
        }
        state.toolResults.push(result)

        stepResult = {
          state,
          toolResult: result,
          stepsComplete: false,
        }
      } else {
        // Check tool access control for regular tools
        if (smartTool.toolNames && !smartTool.toolNames.includes(toolCall.toolName)) {
          const errorResult = {
            success: false,
            summary: `Access denied: ${toolCall.toolName}`,
            fullResult: `Smart tool "${smartTool.name}" is not allowed to use tool "${toolCall.toolName}"`,
          }
          state.toolResults.push(errorResult)

          stepResult = {
            state,
            toolResult: errorResult,
            stepsComplete: false,
          }
        } else {
          const result = await executeTool(toolCall.toolName, toolCall.input)
          state.toolResults.push(result)

          // Only add to message history if not excluded
          if (!excludeFromHistory) {
            state.messages.push({
              role: 'user',
              content: `Tool "${toolCall.toolName}" result:\n${result.fullResult}`,
            })
          }

          stepResult = {
            state,
            toolResult: result,
            stepsComplete: false,
          }
        }
      }
    }

    iteration = generator.next(stepResult)
  }

  // Extract final result based on outputMode
  return extractResult(smartTool, state)
}

/**
 * Check if a yield value is a tool call
 */
function isToolCall(value: unknown): value is SmartToolCall {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toolName' in value &&
    typeof (value as any).toolName === 'string'
  )
}

/**
 * Check if a yield value is StepText
 */
function isStepText(value: unknown): value is StepText {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as any).type === 'STEP_TEXT'
  )
}

/**
 * Check if a yield value is GenerateN
 */
function isGenerateN(value: unknown): value is GenerateN {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as any).type === 'GENERATE_N'
  )
}

/**
 * Build user message from prompt and context
 */
function buildUserMessage(prompt: string | undefined, context: SmartToolContext): string {
  const parts: string[] = []

  if (context.conversationContext) {
    parts.push('## Context')
    parts.push(context.conversationContext)
    parts.push('')
  }

  if (context.userIntent) {
    parts.push('## User Intent')
    parts.push(context.userIntent)
    parts.push('')
  }

  if (prompt) {
    parts.push('## Request')
    parts.push(prompt)
  }

  return parts.join('\n')
}

/**
 * Run single LLM inference step
 */
async function runLLMStep(
  smartTool: GeneratorSmartToolDefinition,
  state: SmartToolState,
  context: SmartToolContext
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set')
  }

  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  })

  const model = smartTool.model || DEFAULT_MODEL

  // Build messages for the API call
  const systemMessages = state.messages.filter(m => m.role === 'system')
  const conversationMessages = state.messages.filter(m => m.role !== 'system')

  // Build system prompt with optional stepPrompt
  let systemPrompt = systemMessages.map(m => m.content).join('\n\n')
  if (smartTool.stepPrompt) {
    systemPrompt += `\n\n<system_reminder>${smartTool.stepPrompt}</system_reminder>`
  }

  const result = await generateText({
    model: openrouter.chat(model),
    system: systemPrompt,
    messages: conversationMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  return result.text.trim()
}

/**
 * Extract final result based on outputMode
 */
function extractResult(
  smartTool: GeneratorSmartToolDefinition,
  state: SmartToolState
): SmartToolResult {
  // If output was explicitly set via set_output tool, use that
  if (state.output !== undefined) {
    return {
      success: true,
      summary: 'Output set',
      data: state.output,
    }
  }

  const outputMode = smartTool.outputMode || 'last_message'
  const assistantMessages = state.messages.filter(m => m.role === 'assistant')

  switch (outputMode) {
    case 'last_message': {
      const lastMessage = assistantMessages[assistantMessages.length - 1]
      return {
        success: true,
        summary: lastMessage?.content.slice(0, 100) || 'Completed',
        data: lastMessage?.content,
      }
    }

    case 'all_messages': {
      return {
        success: true,
        summary: `${assistantMessages.length} responses`,
        data: assistantMessages.map(m => m.content),
      }
    }

    case 'structured_output': {
      const lastMessage = assistantMessages[assistantMessages.length - 1]
      try {
        const parsed = JSON.parse(lastMessage?.content || '{}')
        return {
          success: true,
          summary: 'Structured output',
          data: parsed,
        }
      } catch {
        return {
          success: false,
          summary: 'Failed to parse structured output',
          data: lastMessage?.content,
        }
      }
    }

    default:
      return {
        success: true,
        summary: 'Completed',
        data: state.toolResults[state.toolResults.length - 1],
      }
  }
}

/** @deprecated Use executeGeneratorSmartTool */
export const executeGeneratorAgent = executeGeneratorSmartTool
