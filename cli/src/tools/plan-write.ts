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

const todoStrikeParams = z.object({
  id: z.string().describe('ID of the item to mark completed'),
})

export const planWrite = defineTool({
  name: 'todoWrite',
  description: `Track multi-step task progress. Use this ONCE at the start to set your plan, then use todoStrike to mark items done as you work.

WORKFLOW:
1. Call todoWrite with your plan items (all 'pending')
2. Execute the first task using other tools
3. Call todoStrike to mark it done
4. Repeat until all done

DO NOT call todoWrite repeatedly - set the plan once, then execute it.`,
  parameters: planWriteParams,
  execute: async ({ items }): Promise<ToolResult> => {
    const store = usePlanStore.getState()
    const existingItems = store.items

    // Empty array = clear plan (but not if there's pending work)
    if (items.length === 0) {
      const pending = existingItems.filter(i => i.status !== 'completed')
      if (pending.length > 0) {
        return {
          success: false,
          summary: 'Cannot clear - tasks pending',
          fullResult: `Cannot clear plan. ${pending.length} tasks still pending:\n` +
            pending.map(i => `- ${i.content}`).join('\n') +
            `\n\nExecute "${pending[0].content}" then call todoStrike("${pending[0].id}").`,
          displayInput: 'blocked',
        }
      }
      store.clear()
      return {
        success: true,
        summary: 'Plan cleared',
        fullResult: 'Plan cleared.',
        displayInput: 'clear',
      }
    }

    // GUARD: If plan already exists, reject and redirect to todoStrike
    if (existingItems.length > 0) {
      const pending = existingItems.filter(i => i.status === 'pending')
      const nextItem = pending[0]
      return {
        success: false,
        summary: 'Plan exists - use todoStrike',
        fullResult: `STOP. Plan already exists with ${existingItems.length} items (${pending.length} pending). Do NOT call todoWrite again.\n\n` +
          (nextItem
            ? `Execute "${nextItem.content}" now, then call todoStrike("${nextItem.id}").`
            : `All items done. Give your final response.`),
        displayInput: 'blocked',
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
        summary: 'All done',
        fullResult: 'All items completed. Plan cleared. Provide your final response to the user.',
        displayInput: `${planItems.length} done`,
      }
    }

    store.setItems(planItems)

    // Find first pending/in_progress item to guide the model
    const nextItem = planItems.find(i => i.status === 'pending' || i.status === 'in_progress')
    const nextInstruction = nextItem
      ? `NOW EXECUTE: "${nextItem.content}" - use appropriate tools, then call todoStrike("${nextItem.id}") when done.`
      : 'All tasks pending. Start with the first one.'

    return {
      success: true,
      summary: `${completed}/${planItems.length}`,
      fullResult: `Plan set (${planItems.length} items). ${nextInstruction}\n\nDO NOT call todoWrite again - execute tasks and use todoStrike to mark progress.`,
      displayInput: `${planItems.length} items`,
    }
  },
})

const taskCompleteParams = z.object({
  summary: z.string().describe('Brief summary of what was accomplished'),
})

export const taskComplete = defineTool({
  name: 'taskComplete',
  description: 'Call this when you have finished ALL tasks. Do NOT call this if there are pending plan items - use todoStrike first.',
  parameters: taskCompleteParams,
  execute: async ({ summary }): Promise<ToolResult> => {
    const store = usePlanStore.getState()
    const pending = store.items.filter(i => i.status !== 'completed')

    if (pending.length > 0) {
      return {
        success: false,
        summary: 'Tasks still pending',
        fullResult: `Cannot complete - ${pending.length} tasks still pending:\n` +
          pending.map(i => `- ${i.content}`).join('\n') +
          `\n\nExecute "${pending[0].content}" then call todoStrike("${pending[0].id}").`,
        displayInput: 'blocked',
      }
    }

    store.clear()
    return {
      success: true,
      summary: 'Task complete',
      fullResult: `Task completed: ${summary}\n\nYou may now give your final response to the user.`,
      displayInput: summary.slice(0, 30),
    }
  },
})

export const todoStrike = defineTool({
  name: 'todoStrike',
  description: 'Mark a plan item as completed. Use this after finishing each task instead of rewriting the whole plan.',
  parameters: todoStrikeParams,
  execute: async ({ id }): Promise<ToolResult> => {
    const store = usePlanStore.getState()
    const items = store.items

    const item = items.find(i => i.id === id)
    if (!item) {
      return {
        success: false,
        summary: 'Item not found',
        fullResult: `No item with id "${id}". Current items: ${items.map(i => i.id).join(', ')}`,
        displayInput: id,
      }
    }

    // Mark as completed
    const updatedItems = items.map(i =>
      i.id === id ? { ...i, status: 'completed' as PlanItemStatus } : i
    )

    const completed = updatedItems.filter(i => i.status === 'completed').length
    const total = updatedItems.length

    store.setItems(updatedItems)

    // All done? Tell model to call taskComplete
    if (completed === total) {
      return {
        success: true,
        summary: 'All done - call taskComplete',
        fullResult: `✓ "${item.content}" done. All ${total} tasks completed!\n\nNow call taskComplete("brief summary of what you did") to finish.`,
        displayInput: item.content.slice(0, 20),
      }
    }

    // Find next task
    const nextItem = updatedItems.find(i => i.status === 'pending')

    return {
      success: true,
      summary: `${completed}/${total}`,
      fullResult: `✓ "${item.content}" done. ${completed}/${total} complete.\n\nNOW EXECUTE: "${nextItem!.content}" - then call todoStrike("${nextItem!.id}").`,
      displayInput: item.content.slice(0, 20),
    }
  },
})
