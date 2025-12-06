import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'
import { usePlanStore, type PlanItem } from '../state/plan-store'

const PLAN_SYSTEM_PROMPT = `You are a task planning agent. Your job is to break down tasks into short, actionable items.

Rules:
- Create 2-8 items maximum
- Each item should be 2-3 words
- Use action verbs (Create, Update, Add, Fix, Remove, etc.)
- Items should be sequential steps
- Mark the first incomplete item as "in_progress"
- Keep completed items as "completed"

Output format (JSON array):
[
  {"id": "1", "content": "Create types", "status": "completed"},
  {"id": "2", "content": "Add executor", "status": "in_progress"},
  {"id": "3", "content": "Update handler", "status": "pending"}
]

Only output the JSON array, nothing else.`

const planParams = z.object({
  task: z.string().describe('The task to break down into plan items'),
  currentPlan: z.array(z.object({
    id: z.string(),
    content: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed']),
  })).optional().describe('Current plan items to update/continue'),
})

type PlanParams = z.infer<typeof planParams>

export interface PlanResult {
  items: PlanItem[]
}

export const planAgent = defineAgent<typeof planParams, PlanResult>({
  name: 'plan',
  description: 'Break down a task into short actionable items (2-3 words each, max 8 items)',
  systemPrompt: PLAN_SYSTEM_PROMPT,
  parameters: planParams,

  async execute(params: PlanParams, context): Promise<AgentResult<PlanResult>> {
    // Build the user prompt
    let userPrompt = `Break down this task: "${params.task}"`

    if (params.currentPlan && params.currentPlan.length > 0) {
      userPrompt += `\n\nCurrent plan state:\n${JSON.stringify(params.currentPlan, null, 2)}`
      userPrompt += `\n\nUpdate the plan based on progress. Keep completed items, update statuses.`
    }

    // Execute LLM call
    const result = await executeAgentLLM({
      name: 'plan',
      systemPrompt: PLAN_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Failed to generate plan',
        data: { items: [] },
      }
    }

    // Parse the JSON response
    try {
      const items = JSON.parse(result.text) as PlanItem[]

      // Validate and sanitize
      const validItems = items
        .slice(0, 8) // Max 8 items
        .map((item, index) => ({
          id: item.id || String(index + 1),
          content: String(item.content).slice(0, 50), // Max 50 chars
          status: (['pending', 'in_progress', 'completed'].includes(item.status)
            ? item.status
            : 'pending') as PlanItem['status'],
        }))

      // Update the plan store
      const store = usePlanStore.getState()

      const completed = validItems.filter(i => i.status === 'completed').length
      const allCompleted = completed === validItems.length && validItems.length > 0

      // Clear plan if all items completed, otherwise update
      if (allCompleted) {
        store.clear()
        return {
          success: true,
          summary: 'Plan completed',
          data: { items: [] },
        }
      }

      store.setItems(validItems)

      return {
        success: true,
        summary: `Plan: ${completed}/${validItems.length} done`,
        data: { items: validItems },
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse plan',
        data: { items: [] },
      }
    }
  },
})
