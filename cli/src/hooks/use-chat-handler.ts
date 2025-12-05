import { useCallback, useRef, useState } from 'react'
import { streamChat, getFlavorWord, getSmartShortcut, type Message as APIMessage, type ToolCallRequest } from '../services/openrouter'
import { executeTool, type ToolName } from '../tools'
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
  // Smart shortcut
  incrementUserMessageCount: () => number
  setSmartShortcut: (shortcut: string | null) => void
}

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

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
  const [flavorWord, setFlavorWord] = useState('')
  const [showStatus, setShowStatus] = useState(false)
  const [streamStartTime, setStreamStartTime] = useState(0)
  const [tokenCount, setTokenCount] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMessageId = generateId()
      addMessage({
        id: userMessageId,
        variant: 'user',
        content,
        timestamp: new Date(),
        isComplete: true,
      })

      // Track user message count and generate smart shortcut every 3 messages
      const newCount = incrementUserMessageCount()
      if (newCount > 0 && newCount % 3 === 0) {
        // Build conversation summary for smart shortcut
        const recentMessages = [...messages.slice(-10), { variant: 'user' as const, content }]
        const summary = recentMessages
          .map((m) => `${m.variant}: ${m.content.slice(0, 200)}`)
          .join('\n')

        // Generate smart shortcut asynchronously
        getSmartShortcut(summary).then((shortcut) => {
          if (shortcut) {
            setSmartShortcut(shortcut)
          }
        })
      }

      const aiMessageId = generateId()
      addMessage({
        id: aiMessageId,
        variant: 'ai',
        content: '',
        timestamp: new Date(),
        isComplete: false,
        isStreaming: true,
      })

      // Setup streaming state
      setIsStreaming(true)
      setStreamingMessageId(aiMessageId)
      setStreamStartTime(Date.now())
      setTokenCount(0)
      setShowStatus(false)
      setFlavorWord('')

      // Create abort controller for cancellation
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Get flavor word from Haiku - only show status once we have it
      getFlavorWord(content).then((word) => {
        if (word) {
          setFlavorWord(word)
          setShowStatus(true)
        }
      })

      let currentMessageId = aiMessageId

      try {
        // Build message history for context (only completed messages)
        const chatMessages: APIMessage[] = [
          {
            role: 'system',
            content: `You are Sonder, a helpful AI assistant for cybersecurity and hacking. You have access to tools like search_online.

When you use a tool:
1. The tool will execute and return results
2. You will then receive those results
3. Use the results to answer the user's question directly

IMPORTANT: After receiving tool results, provide your answer based on those results. Do NOT say "let me search" or similar - the search already happened.`,
          },
          ...messages
            .filter((msg) => msg.isComplete && msg.variant !== 'error')
            .map((msg) => ({
              role: (msg.variant === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: msg.content,
            })),
          { role: 'user' as const, content },
        ]

        // Tool call loop - keep going until AI finishes without tool calls
        let continueLoop = true
        let isFirstCall = true
        while (continueLoop && !abortController.signal.aborted) {
          const pendingToolCalls: ToolCallRequest[] = []

          const result = await streamChat(
            chatMessages,
            {
              onChunk: (chunk, tokens) => {
                appendToStreamingMessage(chunk)
                setTokenCount(tokens)
              },
              onToolCall: (toolCall) => {
                // Add tool call to UI
                const toolId = `tool-${toolCall.id}`
                addToolCall({
                  id: toolId,
                  toolName: toolCall.name,
                  params: toolCall.args,
                  status: 'executing',
                  messageId: currentMessageId,
                })
                pendingToolCalls.push(toolCall)
              },
            },
            model,
            abortController.signal,
            isFirstCall, // Only use tools on first call
          )

          // If there are tool calls, execute them and continue
          if (result.toolCalls.length > 0) {
            // Mark the thinking message as complete
            updateMessage(currentMessageId, { isComplete: true, isStreaming: false })

            // Execute each tool call
            for (const toolCall of result.toolCalls) {
              const toolId = `tool-${toolCall.id}`
              const toolResult = await executeTool(toolCall.name as ToolName, toolCall.args)

              // Update tool UI with result
              updateToolCall(toolId, {
                status: toolResult.success ? 'complete' : 'error',
                summary: toolResult.summary,
                fullResult: toolResult.fullResult,
              })

              // Add tool result to message history for next iteration
              chatMessages.push({
                role: 'user',
                content: `[Tool Result for ${toolCall.name}]\n${toolResult.fullResult}\n\nNow provide your answer based on these search results.`,
              })
            }

            // Create a NEW message for the answer
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

            // Continue the loop to get AI's response after tool results
            isFirstCall = false // Disable tools for subsequent calls
          } else {
            // No tool calls - AI is done
            continueLoop = false
          }
        }

        updateMessage(currentMessageId, { isComplete: true, isStreaming: false })
      } catch (error) {
        if (abortController.signal.aborted) {
          updateMessage(currentMessageId, { isComplete: true, isStreaming: false })
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
        // Mark message as interrupted if abort signal was triggered
        if (abortController.signal.aborted) {
          updateMessage(currentMessageId, { isInterrupted: true })
        }
        setIsStreaming(false)
        setStreamingMessageId(null)
        abortControllerRef.current = null
        setShowStatus(false)
        setFlavorWord('')
      }
    },
    [messages, model, addMessage, updateMessage, appendToStreamingMessage, setIsStreaming, setStreamingMessageId, addToolCall, updateToolCall, incrementUserMessageCount, setSmartShortcut],
  )

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    handleSendMessage,
    flavorWord,
    showStatus,
    streamStartTime,
    tokenCount,
    cancelStream,
  }
}
