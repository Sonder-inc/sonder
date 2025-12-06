/**
 * Subgoal Tracking Tools
 *
 * Replaces plan-write tools with subgoal-based tracking.
 * Main agent uses these - they update the UI store.
 */

import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { useSubgoalStore, type Subgoal, type SubgoalStatus } from '../state/subgoal-store'

const addSubgoalParams = z.object({
  id: z.string().describe('Unique identifier for the subgoal'),
  objective: z.string().describe('Short 2-4 word description of the task'),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional().default('pending'),
  plan: z.string().optional().describe('Optional detailed plan'),
  log: z.string().optional().describe('Optional initial log entry'),
})

const updateSubgoalParams = z.object({
  id: z.string().describe('ID of the subgoal to update'),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  plan: z.string().optional().describe('Update the plan'),
  log: z.string().optional().describe('Append a log entry'),
})

const strikeSubgoalParams = z.object({
  id: z.string().describe('ID of the subgoal to mark completed'),
})

export const addSubgoal = defineTool({
  name: 'addSubgoal',
  description: `Add a new subgoal to track progress. Use at the START of multi-step tasks.

WORKFLOW:
1. addSubgoal for each task (all 'pending')
2. Execute tasks using other tools
3. strikeSubgoal(id) to mark done
4. Repeat until all subgoals complete`,
  parameters: addSubgoalParams,
  execute: async ({ id, objective, status, plan, log }): Promise<ToolResult> => {
    const store = useSubgoalStore.getState()
    const existing = store.subgoals[id]

    if (existing) {
      return {
        success: false,
        summary: 'Subgoal exists',
        fullResult: `Subgoal "${id}" already exists. Use updateSubgoal to modify it.`,
        displayInput: id,
      }
    }

    const subgoal: Subgoal = {
      id,
      objective,
      status: status as SubgoalStatus,
      plan,
      logs: log ? [log] : [],
    }

    store.addSubgoal(subgoal)

    const allSubgoals = Object.values(store.subgoals)
    const pending = allSubgoals.filter(s => s.status === 'pending' || s.status === 'in_progress')

    return {
      success: true,
      summary: `Added: ${objective.slice(0, 20)}`,
      fullResult: `Added subgoal "${id}": ${objective}\n\n` +
        (pending.length > 0
          ? `NOW EXECUTE: "${pending[0].objective}" then call strikeSubgoal("${pending[0].id}").`
          : 'Execute tasks and use strikeSubgoal to mark progress.'),
      displayInput: objective.slice(0, 25),
    }
  },
})

export const updateSubgoal = defineTool({
  name: 'updateSubgoal',
  description: 'Update a subgoal status, plan, or add a log entry.',
  parameters: updateSubgoalParams,
  execute: async ({ id, status, plan, log }): Promise<ToolResult> => {
    const store = useSubgoalStore.getState()
    const existing = store.subgoals[id]

    if (!existing) {
      return {
        success: false,
        summary: 'Not found',
        fullResult: `Subgoal "${id}" not found. Available: ${Object.keys(store.subgoals).join(', ') || 'none'}`,
        displayInput: id,
      }
    }

    if (status || plan) {
      store.updateSubgoal(id, { status: status as SubgoalStatus, plan })
    }
    if (log) {
      store.appendLog(id, log)
    }

    return {
      success: true,
      summary: `Updated: ${id}`,
      fullResult: `Updated "${id}"${status ? ` status=${status}` : ''}${log ? ' +log' : ''}`,
      displayInput: id,
    }
  },
})

export const strikeSubgoal = defineTool({
  name: 'strikeSubgoal',
  description: 'Mark a subgoal as completed. Use after finishing each task.',
  parameters: strikeSubgoalParams,
  execute: async ({ id }): Promise<ToolResult> => {
    const store = useSubgoalStore.getState()
    const existing = store.subgoals[id]

    if (!existing) {
      return {
        success: false,
        summary: 'Not found',
        fullResult: `Subgoal "${id}" not found. Available: ${Object.keys(store.subgoals).join(', ') || 'none'}`,
        displayInput: id,
      }
    }

    store.updateSubgoal(id, { status: 'completed' })

    const allSubgoals = Object.values(store.subgoals)
    const completed = allSubgoals.filter(s => s.status === 'completed').length
    const total = allSubgoals.length
    const pending = allSubgoals.filter(s => s.status === 'pending' || s.status === 'in_progress')

    if (completed === total) {
      return {
        success: true,
        summary: 'All done!',
        fullResult: `✓ "${existing.objective}" done. All ${total} subgoals completed!\n\nProvide your final response to the user.`,
        displayInput: existing.objective.slice(0, 20),
      }
    }

    const next = pending[0]
    return {
      success: true,
      summary: `${completed}/${total}`,
      fullResult: `✓ "${existing.objective}" done. ${completed}/${total} complete.\n\n` +
        (next ? `NOW EXECUTE: "${next.objective}" then call strikeSubgoal("${next.id}").` : ''),
      displayInput: existing.objective.slice(0, 20),
    }
  },
})

export const clearSubgoals = defineTool({
  name: 'clearSubgoals',
  description: 'Clear all subgoals. Only use when starting fresh or all tasks complete.',
  parameters: z.object({}),
  execute: async (): Promise<ToolResult> => {
    const store = useSubgoalStore.getState()
    const pending = Object.values(store.subgoals).filter(s => s.status !== 'completed')

    if (pending.length > 0) {
      return {
        success: false,
        summary: 'Tasks pending',
        fullResult: `Cannot clear - ${pending.length} tasks still pending:\n` +
          pending.map(s => `- ${s.objective}`).join('\n') +
          `\n\nExecute "${pending[0].objective}" then call strikeSubgoal("${pending[0].id}").`,
        displayInput: 'blocked',
      }
    }

    store.clear()
    return {
      success: true,
      summary: 'Cleared',
      fullResult: 'All subgoals cleared.',
      displayInput: 'clear',
    }
  },
})
