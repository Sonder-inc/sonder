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
  setIsStreaming: (val: boolean) => void
  setStreamingMessageId: (id: string | null) => void
  addToolCall: (call: ToolCall) => void
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void
  incrementUserMessageCount: () => number
  setSmartShortcut: (shortcut: string | null) => void
}

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const SYSTEM_PROMPT = `You are Sonder, a helpful AI assistant for cybersecurity and hacking. You have access to tools like search_online.

When you use a tool:
1. The tool will execute and return results
2. You will then receive those results
3. Use the results to answer the user's question directly

IMPORTANT: After receiving tool results, provide your answer based on those results. Do NOT say "let me search" or similar - the search already happened.`

export function useChatHandler({
  model,
  messages,
  addMessage,
  updateMessage,
  appendToStreamingMessage,
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

      // Add placeholder AI message
      const aiMessageId = generateId()
      addMessage({
        id: aiMessageId,
        variant: 'ai',
        content: '',
        timestamp: new Date(),
        isComplete: false,
        isStreaming: true,
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

        // Tool call loop
        let continueLoop = true
        let isFirstCall = true

        while (continueLoop && !abortController.signal.aborted) {
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
            },
            model,
            abortController.signal,
            isFirstCall,
          )

          if (result.toolCalls.length > 0) {
            // Mark thinking message as complete
            updateMessage(currentMessageId, { isComplete: true, isStreaming: false })

            // Execute tool calls and add results to history
            for (const toolCall of result.toolCalls) {
              const { result: toolResult } = await executeToolCall(toolCall)
              chatMessages.push({
                role: 'user',
                content: `[Tool Result for ${toolCall.name}]\n${toolResult.fullResult}\n\nNow provide your answer based on these search results.`,
              })
            }

            // Create new message for AI response
            const answerMessageId = generateId()
            addMessage({
              id: answerMessageId,
              variant: 'ai',
              content: '',
              timestamp: new Date(),
              isComplete: false,
              isStreaming: true,
            })
            currentMessageId = answerMessageId
            setStreamingMessageId(answerMessageId)
            isFirstCall = false
          } else {
            continueLoop = false
          }
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
