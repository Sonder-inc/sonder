import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { executeAgent, getAgentDescriptions } from '../agents'
import type { CouncilResult } from '../agents/council-agent'

const spawnAgentParams = z.object({
  task: z.string().describe('What needs to be done - council will pick the right agent and params'),
  context: z.string().optional().describe('Additional context (file contents, scan results, etc)'),
})

/**
 * Build description with all available agents
 */
function buildDescription(): string {
  const base = `Delegate tasks to specialized subagents. Just describe what you need - council handles agent selection and parameters.

How it works:
1. You provide a task description
2. Council (internal) analyzes and picks the best agent(s)
3. Council infers the correct parameters from your task
4. Agent executes and returns results

Use this when you need specialized capabilities.`

  const agents = getAgentDescriptions()

  // Filter out council from the list (it's internal)
  const agentList = Object.entries(agents)
    .filter(([name]) => name !== 'council')
    .map(([name, desc]) => `  ${name}: ${desc}`)
    .join('\n')

  return `${base}\n\nAvailable agents:\n${agentList}`
}

export const spawnAgent = defineTool({
  name: 'spawnAgent',
  description: buildDescription(),
  parameters: spawnAgentParams,

  async execute({ task, context }): Promise<ToolResult> {
    // === PHASE 1: Council negotiation (isolated context) ===
    // This happens in a "fake branch" - council figures out agent + params
    const councilResult = await executeAgent('council', { task }, {
      conversationContext: context || '',
      userIntent: task,
    })

    if (!councilResult.success || !councilResult.data) {
      return {
        success: false,
        summary: 'Failed to determine agent',
        fullResult: councilResult.summary,
        displayColor: 'error',
      }
    }

    const decision = councilResult.data as CouncilResult

    if (decision.selectedAgents.length === 0) {
      return {
        success: false,
        summary: 'No suitable agent found',
        fullResult: decision.reasoning,
        displayColor: 'error',
      }
    }

    // === PHASE 2: Execute selected agents ===
    const results: Array<{ agent: string; success: boolean; summary: string; data?: unknown }> = []
    const agentContext = { conversationContext: context || '', userIntent: task }

    if (decision.executionOrder === 'parallel') {
      const promises = decision.selectedAgents.map(async (agent) => {
        const params = (decision.parameters[agent] || {}) as Record<string, unknown>
        const result = await executeAgent(agent, params, agentContext)
        return { agent, success: result.success, summary: result.summary, data: result.data }
      })
      results.push(...await Promise.all(promises))
    } else {
      for (const agent of decision.selectedAgents) {
        const params = (decision.parameters[agent] || {}) as Record<string, unknown>
        const result = await executeAgent(agent, params, agentContext)
        results.push({ agent, success: result.success, summary: result.summary, data: result.data })
      }
    }

    // === PHASE 3: Condense results ===
    const anyFailed = results.some(r => !r.success)
    const agentNames = decision.selectedAgents.join('+')

    // Build condensed summary (what main agent sees)
    const summary = results
      .map(r => `${r.agent}: ${r.summary}`)
      .join(' | ')
      .slice(0, 120)

    // Full result includes decision reasoning + agent outputs
    const fullResult = [
      `Task: ${decision.understanding}`,
      `Agents: ${agentNames} (${decision.executionOrder})`,
      `Why: ${decision.reasoning}`,
      '',
      '--- Results ---',
      ...results.map(r => `[${r.agent}] ${r.success ? '✓' : '✗'}\n${r.summary}\n${r.data ? JSON.stringify(r.data, null, 2) : ''}`),
    ].join('\n')

    return {
      success: !anyFailed,
      summary,
      fullResult,
      displayName: agentNames,
      displayInput: task.slice(0, 50) + (task.length > 50 ? '...' : ''),
      displayMiddle: decision.understanding,
      displayColor: anyFailed ? 'error' : 'success',
    }
  },
})
