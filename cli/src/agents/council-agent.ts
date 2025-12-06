/**
 * Council Agent - Agent Picker/Orchestrator
 *
 * Decides which agent(s) to use for a given task.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'
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
      return `- ${name}: ${info.spawnerPrompt || info.description}\n  params:\n${paramList || '    (none)'}`
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

export interface CouncilResult {
  understanding: string
  selectedAgents: string[]
  reasoning: string
  executionOrder: 'parallel' | 'sequential'
  parameters: Record<string, unknown>
}

export const councilAgent = defineGeneratorAgent<typeof councilParams, CouncilResult>({
  name: 'council',
  id: 'council',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Agent picker/orchestrator. Decides which agents to use for a task.',

  spawnerPrompt: 'Internal orchestration agent that analyzes tasks and selects the best agents to handle them.',

  outputMode: 'structured_output',
  outputSchema: {
    type: 'object',
    properties: {
      understanding: { type: 'string' },
      selectedAgents: { type: 'array', items: { type: 'string' } },
      reasoning: { type: 'string' },
      executionOrder: { type: 'string', enum: ['parallel', 'sequential'] },
      parameters: { type: 'object' },
    },
    required: ['understanding', 'selectedAgents', 'reasoning', 'executionOrder', 'parameters'],
  },

  // Dynamic system prompt built at runtime
  get systemPrompt() {
    return buildCouncilPrompt()
  },

  parameters: councilParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Council is pure LLM inference - just run a step
    yield 'STEP'
  },
})
