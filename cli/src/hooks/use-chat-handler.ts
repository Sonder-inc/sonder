import { useCallback } from 'react'
import { streamChat, type Message as APIMessage, type ToolCallRequest } from '../services/openrouter'
import { useFlavorWord } from './use-flavor-word'
import { useSmartShortcut } from './use-smart-shortcut'
import { useStreaming } from './use-streaming'
import { useToolExecutor } from './use-tool-executor'
import { usePlanStore } from '../state/plan-store'
import { useThreadStore } from '../state/thread-store'
import type { ChatMessage, ToolCall } from '../types/chat'

interface UseChatHandlerOptions {
  model: string
  messages: ChatMessage[]
  addMessage: (msg: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  appendToStreamingMessage: (chunk: string) => void
  appendToThinkingContent: (chunk: string) => void
  setIsStreaming: (val: boolean) => void
  setStreamingMessageId: (id: string | null) => void
  addToolCall: (call: ToolCall) => void
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void
  incrementUserMessageCount: () => number
  setSmartShortcut: (shortcut: string | null) => void
}

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const SYSTEM_PROMPT = `You are Sonder, a helpful AI assistant for cybersecurity and hacking.

IMPORTANT: When you need to use a tool, CALL IT DIRECTLY. Do not say "I'll use X" or "Let me try X" - just invoke the tool immediately.

You have full autonomy to chain multiple tool calls until your task is complete:
- Call tools directly without announcing them
- If a tool fails, retry with different parameters or try alternatives
- Use todoWrite to track multi-step progress
- Only provide a final text response when you're truly done`

const MAX_TOOL_ITERATIONS = 10 // Prevent infinite loops

export function useChatHandler({
  model,
  messages,
  addMessage,
  updateMessage,
  appendToStreamingMessage,
  appendToThinkingContent,
  setIsStreaming,
  setStreamingMessageId,
  addToolCall,
  updateToolCall,
  incrementUserMessageCount,
  setSmartShortcut,
}: UseChatHandlerOptions) {
  // Compose smaller hooks
  const { flavorWord, showStatus, fetchFlavorWord, resetFlavorWord } = useFlavorWord()
  const { streamStartTime, tokenCount, startStreaming, updateTokenCount, endStreaming, cancelStream, abortControllerRef } = useStreaming()
  const { checkAndGenerateShortcut } = useSmartShortcut({ messages, setSmartShortcut })
  const { registerToolCall, executeToolCall } = useToolExecutor({ addToolCall, updateToolCall })

  // Thread store for linking messages
  const currentThreadId = useThreadStore((state) => state.currentThreadId)
  const addMessageToThread = useThreadStore((state) => state.addMessageToThread)
  const checkAutoCompact = useThreadStore((state) => state.checkAutoCompact)

  const handleSendMessage = useCallback(
    async (content: string) => {
      // Clear any existing plan from previous message
      usePlanStore.getState().clear()

      // Add user message
      const userMessageId = generateId()
      addMessage({
        id: userMessageId,
        variant: 'user',
        content,
        timestamp: new Date(),
        isComplete: true,
      })

      // Link user message to current thread
      if (currentThreadId) {
        addMessageToThread(currentThreadId, userMessageId)
      }

      // Check for smart shortcut generation
      const newCount = incrementUserMessageCount()
      checkAndGenerateShortcut(content, newCount)

      // Add placeholder AI message (thinking starts false until we receive reasoning tokens)
      const aiMessageId = generateId()
      let thinkingStartTime: number | null = null
      addMessage({
        id: aiMessageId,
        variant: 'ai',
        content: '',
        timestamp: new Date(),
        isComplete: false,
        isStreaming: true,
        isThinking: false,
      })

      // Setup streaming
      setIsStreaming(true)
      setStreamingMessageId(aiMessageId)
      const abortController = startStreaming()

      // Fetch flavor word asynchronously
      fetchFlavorWord(content)

      let currentMessageId = aiMessageId

      try {
        // Build message history
        const chatMessages: APIMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
            .filter((msg) => msg.isComplete && msg.variant !== 'error')
            .map((msg) => ({
              role: (msg.variant === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: msg.content,
            })),
          { role: 'user' as const, content },
        ]

        // Agentic tool call loop - allows multiple iterations
        let continueLoop = true
        let iterationCount = 0

        while (continueLoop && !abortController.signal.aborted && iterationCount < MAX_TOOL_ITERATIONS) {
          const pendingToolCalls: ToolCallRequest[] = []

          const result = await streamChat(
            chatMessages,
            {
              onChunk: (chunk, tokens) => {
                appendToStreamingMessage(chunk)
                updateTokenCount(tokens)
              },
              onToolCall: (toolCall) => {
                registerToolCall(toolCall, currentMessageId)
                pendingToolCalls.push(toolCall)
              },
              onReasoning: (chunk) => {
                // Set thinking true on first reasoning chunk
                if (thinkingStartTime === null) {
                  thinkingStartTime = Date.now()
                  updateMessage(currentMessageId, { isThinking: true })
                }
                appendToThinkingContent(chunk)
              },
              onReasoningComplete: () => {
                const thinkingDuration = thinkingStartTime ? Date.now() - thinkingStartTime : 0
                updateMessage(currentMessageId, {
                  isThinking: false,
                  thinkingDurationMs: thinkingDuration,
                })
              },
            },
            model,
            abortController.signal,
            true, // Always enable tools for agentic loop
          )

          if (result.toolCalls.length > 0) {
            iterationCount++
            // Mark current message as complete
            updateMessage(currentMessageId, { isComplete: true, isStreaming: false })

            // Execute tool calls in parallel and collect results
            const toolResults = await Promise.all(
              result.toolCalls.map(async (toolCall) => {
                const { result: toolResult } = await executeToolCall(toolCall)
                return { toolCall, toolResult }
              })
            )

            // Add all results to history
            const resultsContent = toolResults
              .map(({ toolCall, toolResult }) => {
                const status = toolResult.success ? '✓' : '✗ FAILED'
                return `[${toolCall.name}] ${status}\n${toolResult.fullResult}`
              })
              .join('\n\n---\n\n')

            // Check if any tool failed
            const anyFailed = toolResults.some(({ toolResult }) => !toolResult.success)

            chatMessages.push({
              role: 'user',
              content: `Tool results:\n\n${resultsContent}\n\n${
                anyFailed
                  ? 'Some tools failed. Retry with different parameters or try a different tool.'
                  : 'If you need more tools, call them now. Otherwise give your final answer.'
              }`,
            })

            // Create new message for AI response
            const answerMessageId = generateId()
            thinkingStartTime = null // Reset for new message
            addMessage({
              id: answerMessageId,
              variant: 'ai',
              content: '',
              timestamp: new Date(),
              isComplete: false,
              isStreaming: true,
              isThinking: false,
            })
            currentMessageId = answerMessageId
            setStreamingMessageId(answerMessageId)
          } else {
            continueLoop = false
          }
        }

        // Warn if we hit the iteration limit
        if (iterationCount >= MAX_TOOL_ITERATIONS) {
          appendToStreamingMessage('\n\n*[Reached maximum tool iterations]*')
        }

        updateMessage(currentMessageId, { isComplete: true, isStreaming: false })
        // Link AI message to current thread
        if (currentThreadId) {
          addMessageToThread(currentThreadId, currentMessageId)
          // Check for auto-compact (fire and forget)
          void checkAutoCompact()
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          updateMessage(currentMessageId, { isComplete: true, isStreaming: false })
          // Link interrupted message to thread
          if (currentThreadId) {
            addMessageToThread(currentThreadId, currentMessageId)
          }
        } else {
          const errorMsg = error instanceof Error ? error.message : String(error)
          updateMessage(currentMessageId, {
            content: `Error: ${errorMsg}`,
            variant: 'error',
            isComplete: true,
            isStreaming: false,
          })
        }
      } finally {
        if (abortControllerRef.current?.signal.aborted) {
          updateMessage(currentMessageId, { isInterrupted: true })
        }
        setIsStreaming(false)
        setStreamingMessageId(null)
        endStreaming()
        resetFlavorWord()
      }
    },
    [
      messages,
      model,
      addMessage,
      updateMessage,
      appendToStreamingMessage,
      appendToThinkingContent,
      setIsStreaming,
      setStreamingMessageId,
      incrementUserMessageCount,
      fetchFlavorWord,
      resetFlavorWord,
      startStreaming,
      updateTokenCount,
      endStreaming,
      checkAndGenerateShortcut,
      registerToolCall,
      executeToolCall,
      abortControllerRef,
      currentThreadId,
      addMessageToThread,
      checkAutoCompact,
    ],
  )

  return {
    handleSendMessage,
    flavorWord,
    showStatus,
    streamStartTime,
    tokenCount,
    cancelStream,
  }
}
