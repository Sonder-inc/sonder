import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type { AgentContext, AgentResult } from '../agents/types'

/** Model used for subagents - fast and cheap */
const SUBAGENT_MODEL = 'anthropic/claude-3.5-haiku'

export interface AgentExecutorConfig {
  name: string
  systemPrompt: string
  userPrompt: string
  context: AgentContext
}

export interface AgentExecutorResult {
  success: boolean
  text: string
  error?: string
}

/**
 * Execute an LLM call for a subagent
 * Returns raw text - agent is responsible for parsing
 */
export async function executeAgentLLM(
  config: AgentExecutorConfig
): Promise<AgentExecutorResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return {
      success: false,
      text: '',
      error: 'OPENROUTER_API_KEY not set',
    }
  }

  try {
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })

    // Build the full prompt with context
    const fullPrompt = buildAgentPrompt(config)

    const result = await generateText({
      model: openrouter.chat(SUBAGENT_MODEL),
      system: config.systemPrompt,
      prompt: fullPrompt,
    })

    return {
      success: true,
      text: result.text.trim(),
    }
  } catch (err) {
    return {
      success: false,
      text: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Build the prompt for a subagent including context
 */
function buildAgentPrompt(config: AgentExecutorConfig): string {
  const parts: string[] = []

  // Add conversation context if available
  if (config.context.conversationContext) {
    parts.push('## Conversation Context')
    parts.push(config.context.conversationContext)
    parts.push('')
  }

  // Add user intent if available
  if (config.context.userIntent) {
    parts.push('## User Intent')
    parts.push(config.context.userIntent)
    parts.push('')
  }

  // Add the main task
  parts.push('## Task')
  parts.push(config.userPrompt)

  return parts.join('\n')
}
