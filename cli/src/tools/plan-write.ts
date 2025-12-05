import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { usePlanStore, type PlanItem, type PlanItemStatus } from '../state/plan-store'

const planItemSchema = z.object({
  id: z.string().describe('Unique identifier'),
  content: z.string().describe('Short 2-3 word task'),
  status: z.enum(['pending', 'in_progress', 'completed']).describe('Current status'),
})

const planWriteParams = z.object({
  items: z.array(planItemSchema).max(8).describe('Plan items (max 8). Pass empty array [] to clear plan.'),
})

export const planWrite = defineTool({
  name: 'plan',
  description: 'Update the plan displayed during streaming. Pass items array to set plan, pass empty array [] to clear. Mark items in_progress when working, completed when done. Plan auto-clears when all items completed.',
  parameters: planWriteParams,
  execute: async ({ items }): Promise<ToolResult> => {
    const store = usePlanStore.getState()

    // Empty array = clear plan
    if (items.length === 0) {
      store.clear()
      return {
        success: true,
        summary: 'Plan cleared',
        fullResult: 'Plan cleared',
      }
    }

    const planItems: PlanItem[] = items.map(item => ({
      id: item.id,
      content: item.content,
      status: item.status as PlanItemStatus,
    }))

    // Check if all completed
    const completed = planItems.filter(i => i.status === 'completed').length
    if (completed === planItems.length) {
      store.clear()
      return {
        success: true,
        summary: 'Plan completed',
        fullResult: 'All items done, plan cleared',
      }
    }

    store.setItems(planItems)

    return {
      success: true,
      summary: `Plan: ${completed}/${planItems.length} done`,
      fullResult: `Plan updated. ${planItems.length} items.`,
    }
  },
})
