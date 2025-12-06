import { useCallback } from 'react'
import { executeTool } from '../tools'
import { useThreadStore } from '../state/thread-store'
import type { ToolCall } from '../types/chat'
import type { ToolCallRequest } from '../services/openrouter'
import type { FileChangeStats } from '../tools/types'

interface UseToolExecutorOptions {
  addToolCall: (call: ToolCall) => void
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void
}

interface ToolExecutionResult {
  toolId: string
  result: {
    success: boolean
    summary: string
    fullResult: string
    fileStats?: FileChangeStats
  }
}

interface UseToolExecutorResult {
  registerToolCall: (toolCall: ToolCallRequest, messageId: string) => string
  executeToolCall: (toolCall: ToolCallRequest) => Promise<ToolExecutionResult>
}

/**
 * Hook for managing tool call registration and execution
 */
export function useToolExecutor({
  addToolCall,
  updateToolCall,
}: UseToolExecutorOptions): UseToolExecutorResult {
  const currentThreadId = useThreadStore((state) => state.currentThreadId)
  const updateThreadStats = useThreadStore((state) => state.updateThreadStats)

  const registerToolCall = useCallback(
    (toolCall: ToolCallRequest, messageId: string): string => {
      const toolId = `tool-${toolCall.id}`
      addToolCall({
        id: toolId,
        toolName: toolCall.name,
        params: toolCall.args,
        status: 'executing',
        messageId,
      })
      return toolId
    },
    [addToolCall],
  )

  const executeToolCall = useCallback(
    async (toolCall: ToolCallRequest): Promise<ToolExecutionResult> => {
      const toolId = `tool-${toolCall.id}`
      const toolResult = await executeTool(toolCall.name, toolCall.args)

      updateToolCall(toolId, {
        status: toolResult.success ? 'complete' : 'error',
        summary: toolResult.summary,
        fullResult: toolResult.fullResult,
        displayName: toolResult.displayName,
        displayInput: toolResult.displayInput,
        displayMiddle: toolResult.displayMiddle,
        displayColor: toolResult.displayColor,
      })

      // Update thread stats if tool returned file changes
      if (toolResult.fileStats && currentThreadId) {
        updateThreadStats(currentThreadId, {
          additions: toolResult.fileStats.additions,
          changes: toolResult.fileStats.changes,
          deletions: toolResult.fileStats.deletions,
        })
      }

      return {
        toolId,
        result: toolResult,
      }
    },
    [updateToolCall, currentThreadId, updateThreadStats],
  )

  return {
    registerToolCall,
    executeToolCall,
  }
}
