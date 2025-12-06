/**
 * Council Agent - Agent Picker/Orchestrator
 *
 * Decides which agent(s) to use for a given task.
 * Uses rich schema info to properly infer parameters.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'
import { getAgentSchemas } from './registry'

/**
 * Build dynamic system prompt with current agent schemas
 */
function buildCouncilPrompt(): string {
  const schemas = getAgentSchemas()

  const agentDocs = Object.entries(schemas)
    .map(([name, info]) => {
      const paramList = Object.entries(info.params)
        .map(([key, desc]) => `    ${key}: ${desc}`)
        .join('\n')
      return `- ${name}: ${info.description}\n  params:\n${paramList || '    (none)'}`
    })
    .join('\n\n')

  return `You are the council agent. Given a task, decide which agent(s) to use and infer the correct parameters.

AVAILABLE AGENTS:
${agentDocs}

IMPORTANT:
1. Analyze the task to understand WHAT needs to be done
2. Select the BEST agent(s) for the job
3. INFER all required parameters from the task context
4. If a parameter cannot be inferred, use sensible defaults

Output format (JSON only):
{
  "understanding": "what the user wants to accomplish",
  "selectedAgents": ["agent1"],
  "reasoning": "why this agent, brief",
  "executionOrder": "parallel|sequential",
  "parameters": {
    "agent1": { "param1": "value", "param2": "value" }
  }
}

Only output valid JSON, nothing else.`
}

const councilParams = z.object({
  task: z.string().describe('The task to be accomplished'),
  constraints: z.array(z.string()).optional().describe('Any constraints or preferences'),
})

type CouncilParams = z.infer<typeof councilParams>

export interface CouncilResult {
  understanding: string
  selectedAgents: string[]
  reasoning: string
  executionOrder: 'parallel' | 'sequential'
  parameters: Record<string, unknown>
}

export const councilAgent = defineAgent<typeof councilParams, CouncilResult>({
  name: 'council',
  description: 'Agent picker/orchestrator. Decides which agents to use for a task.',
  systemPrompt: '', // Dynamic, built at runtime
  parameters: councilParams,

  async execute(params: CouncilParams, context): Promise<AgentResult<CouncilResult>> {
    // Build dynamic prompt with current agent schemas
    const systemPrompt = buildCouncilPrompt()

    const userPrompt = `Task: ${params.task}${
      params.constraints?.length ? `\nConstraints: ${params.constraints.join(', ')}` : ''
    }${
      context.conversationContext ? `\n\nContext:\n${context.conversationContext}` : ''
    }`

    const result = await executeAgentLLM({
      name: 'council',
      systemPrompt,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Council decision failed',
        data: {
          understanding: '',
          selectedAgents: [],
          reasoning: 'Failed to decide',
          executionOrder: 'sequential',
          parameters: {},
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as CouncilResult
      return {
        success: true,
        summary: `${data.selectedAgents.join('+')} → ${data.understanding.slice(0, 50)}`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse council decision',
        data: {
          understanding: '',
          selectedAgents: [],
          reasoning: result.text,
          executionOrder: 'sequential',
          parameters: {},
        },
      }
    }
  },
})
