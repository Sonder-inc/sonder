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
  GeneratorAgentDefinition,
  AgentContext,
  AgentResult,
  AgentState,
  AgentStepContext,
  StepResult,
  AgentToolCall,
  StepText,
  GenerateN,
  AgentSubgoal,
} from '../agents/types'

const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku'

export interface GeneratorExecutorConfig {
  agent: GeneratorAgentDefinition
  params: Record<string, unknown>
  prompt?: string
  context: AgentContext
}

/**
 * Execute a generator-based agent
 */
export async function executeGeneratorAgent(
  config: GeneratorExecutorConfig
): Promise<AgentResult> {
  const { agent, params, prompt, context } = config

  // Initialize agent state
  const agentState: AgentState = {
    messages: [],
    toolResults: [],
    subgoals: {},
  }

  // Add system prompt
  if (agent.systemPrompt) {
    agentState.messages.push({ role: 'system', content: agent.systemPrompt })
  }

  // Add instructions prompt
  if (agent.instructionsPrompt) {
    agentState.messages.push({ role: 'system', content: agent.instructionsPrompt })
  }

  // Add user context and prompt
  const userMessage = buildUserMessage(prompt, context)
  if (userMessage) {
    agentState.messages.push({ role: 'user', content: userMessage })
  }

  // Create agent-specific logger
  const logger = createAgentLogger(agent.name)

  // Create step context
  const stepContext: AgentStepContext = {
    params,
    prompt,
    agentState,
    logger,
  }

  // Create and run generator
  const generator = agent.handleSteps(stepContext)

  let stepResult: StepResult = {
    agentState,
    toolResult: undefined,
    stepsComplete: false,
  }

  let iteration = generator.next(stepResult)

  while (!iteration.done) {
    const yieldValue = iteration.value

    if (yieldValue === 'STEP') {
      // Run single LLM inference step
      const llmResult = await runLLMStep(agent, agentState, context)
      agentState.messages.push({ role: 'assistant', content: llmResult })

      stepResult = {
        agentState,
        toolResult: llmResult,
        stepsComplete: false,
      }
    } else if (yieldValue === 'STEP_ALL') {
      // Run LLM steps until completion (no tool calls)
      let continueLoop = true
      let loopCount = 0
      const maxLoops = 10 // Safety limit

      while (continueLoop && loopCount < maxLoops) {
        const llmResult = await runLLMStep(agent, agentState, context)
        agentState.messages.push({ role: 'assistant', content: llmResult })
        loopCount++

        // Simple heuristic: if response is short or doesn't ask for tools, stop
        if (llmResult.length < 100 || !llmResult.includes('TOOL:')) {
          continueLoop = false
        }
      }

      stepResult = {
        agentState,
        toolResult: undefined,
        stepsComplete: true,
      }
    } else if (isStepText(yieldValue)) {
      // StepText: inject text directly into assistant messages
      agentState.messages.push({ role: 'assistant', content: yieldValue.text })

      stepResult = {
        agentState,
        toolResult: undefined,
        stepsComplete: false,
      }
    } else if (isGenerateN(yieldValue)) {
      // GenerateN: generate N parallel LLM responses for multi-arm exploration
      const n = yieldValue.n
      const responses = await Promise.all(
        Array.from({ length: n }, () => runLLMStep(agent, agentState, context))
      )

      stepResult = {
        agentState,
        toolResult: undefined,
        stepsComplete: false,
        nResponses: responses,
      }
    } else if (isToolCall(yieldValue)) {
      // Execute tool call
      const toolCall = yieldValue as AgentToolCall
      const excludeFromHistory = toolCall.includeToolCall === false

      // Handle special agent control tools
      if (toolCall.toolName === 'set_output') {
        // set_output: explicitly set agent output
        const input = toolCall.input as { data?: unknown }
        agentState.output = (input.data ?? input) as Record<string, unknown>

        const result = {
          success: true,
          summary: 'Output set',
          fullResult: 'Output has been set',
        }
        agentState.toolResults.push(result)

        stepResult = {
          agentState,
          toolResult: result,
          stepsComplete: false,
        }
      } else if (toolCall.toolName === 'add_message') {
        // add_message: add a message to the conversation
        const input = toolCall.input as { role: 'user' | 'assistant'; content: string }
        agentState.messages.push({
          role: input.role,
          content: input.content,
        })

        const result = {
          success: true,
          summary: 'Message added',
          fullResult: `Added ${input.role} message`,
        }
        agentState.toolResults.push(result)

        stepResult = {
          agentState,
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

        const subgoal: AgentSubgoal = {
          id: input.id,
          objective: input.objective,
          status: input.status || 'pending',
          plan: input.plan,
          logs: input.log ? [input.log] : [],
        }

        agentState.subgoals[input.id] = subgoal

        const result = {
          success: true,
          summary: `Subgoal added: ${input.objective.slice(0, 30)}`,
          fullResult: `Added subgoal "${input.id}": ${input.objective}`,
        }
        agentState.toolResults.push(result)

        stepResult = {
          agentState,
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

        const existing = agentState.subgoals[input.id]
        if (!existing) {
          // Create if doesn't exist
          agentState.subgoals[input.id] = {
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
        agentState.toolResults.push(result)

        stepResult = {
          agentState,
          toolResult: result,
          stepsComplete: false,
        }
      } else {
        // Check tool access control for regular tools
        if (agent.toolNames && !agent.toolNames.includes(toolCall.toolName)) {
          const errorResult = {
            success: false,
            summary: `Access denied: ${toolCall.toolName}`,
            fullResult: `Agent "${agent.name}" is not allowed to use tool "${toolCall.toolName}"`,
          }
          agentState.toolResults.push(errorResult)

          stepResult = {
            agentState,
            toolResult: errorResult,
            stepsComplete: false,
          }
        } else {
          const result = await executeTool(toolCall.toolName, toolCall.input)
          agentState.toolResults.push(result)

          // Only add to message history if not excluded
          if (!excludeFromHistory) {
            agentState.messages.push({
              role: 'user',
              content: `Tool "${toolCall.toolName}" result:\n${result.fullResult}`,
            })
          }

          stepResult = {
            agentState,
            toolResult: result,
            stepsComplete: false,
          }
        }
      }
    }

    iteration = generator.next(stepResult)
  }

  // Extract final result based on outputMode
  return extractResult(agent, agentState)
}

/**
 * Check if a yield value is a tool call
 */
function isToolCall(value: unknown): value is AgentToolCall {
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
function buildUserMessage(prompt: string | undefined, context: AgentContext): string {
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
  agent: GeneratorAgentDefinition,
  agentState: AgentState,
  context: AgentContext
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set')
  }

  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  })

  const model = agent.model || DEFAULT_MODEL

  // Build messages for the API call
  const systemMessages = agentState.messages.filter(m => m.role === 'system')
  const conversationMessages = agentState.messages.filter(m => m.role !== 'system')

  // Build system prompt with optional stepPrompt
  let systemPrompt = systemMessages.map(m => m.content).join('\n\n')
  if (agent.stepPrompt) {
    systemPrompt += `\n\n<system_reminder>${agent.stepPrompt}</system_reminder>`
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
 * Extract final result based on agent's outputMode
 */
function extractResult(
  agent: GeneratorAgentDefinition,
  agentState: AgentState
): AgentResult {
  // If output was explicitly set via set_output tool, use that
  if (agentState.output !== undefined) {
    return {
      success: true,
      summary: 'Output set',
      data: agentState.output,
    }
  }

  const outputMode = agent.outputMode || 'last_message'
  const assistantMessages = agentState.messages.filter(m => m.role === 'assistant')

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
        data: agentState.toolResults[agentState.toolResults.length - 1],
      }
  }
}
