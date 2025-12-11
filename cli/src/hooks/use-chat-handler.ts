import { useCallback } from 'react'
import { streamChat, type Message as APIMessage, type ToolCallRequest } from '../services/openrouter'
import { claudeService } from '../services/claude'
import { codexService } from '../services/codex'
import { useFlavorWord } from './use-flavor-word'
import { useSmartShortcut } from './use-smart-shortcut'
import { useStreaming } from './use-streaming'
import { useToolExecutor } from './use-tool-executor'
import { useSubgoalStore } from '../state/subgoal-store'
import { useThreadStore } from '../state/thread-store'
import { useClaudeSessionStore } from '../state/claude-session-store'
import { usesClaudeCode, usesCodex, type ModelName } from '../constants/app-constants'
import type { ChatMessage, ToolCall } from '../types/chat'

interface UseChatHandlerOptions {
  model: string        // Full model ID (e.g., 'anthropic/claude-3.7-sonnet')
  modelName: ModelName // Short model name (e.g., 'claude', 'sonder')
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

TOOL USAGE:
- Call tools DIRECTLY without announcing ("I'll use X")
- Chain multiple tools until task is complete
- If a tool fails, retry with different params or try alternatives

MULTI-STEP TASKS:
1. addSubgoal for each task at the START (all 'pending')
2. Execute first task with appropriate tools
3. strikeSubgoal(id) to mark done - tells you next task
4. Repeat 2-3 for each task
5. Give your final response when ALL subgoals complete

CRITICAL: Complete all subgoals before stopping.`

export function useChatHandler({
  model,
  modelName,
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

  // Claude session store for resuming conversations
  const getClaudeSession = useClaudeSessionStore((state) => state.getSession)
  const setClaudeSession = useClaudeSessionStore((state) => state.setSession)

  const handleSendMessage = useCallback(
    async (content: string) => {

      // Clear any existing subgoals from previous message
      useSubgoalStore.getState().clear()

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

      // Fetch flavor word FIRST (before model starts) - acts as thinking indicator
      await fetchFlavorWord(content)

      let currentMessageId = aiMessageId

      try {
        // Check if model should use Claude Code or Codex headless
        const useClaudeCodePath = usesClaudeCode(modelName)
        const useCodexPath = usesCodex(modelName)

        if (useClaudeCodePath) {
          // Claude Code headless path - Claude handles tools internally
          const existingSessionId = currentThreadId ? getClaudeSession(currentThreadId) : null

          await claudeService.send(content, {
            model: 'claude-sonnet-4-20250514', // Claude Code model name
            sessionId: existingSessionId ?? undefined,

            onInit: (sessionId) => {
              // Store session ID early for resumption
              if (currentThreadId && sessionId) {
                setClaudeSession(currentThreadId, sessionId)
              }
            },

            onText: (text) => {
              appendToStreamingMessage(text)
              updateTokenCount(Math.ceil(text.length / 4))
            },

            onThinking: (text) => {
              if (thinkingStartTime === null) {
                thinkingStartTime = Date.now()
                updateMessage(currentMessageId, { isThinking: true })
              }
              appendToThinkingContent(text)
            },

            onThinkingComplete: () => {
              const duration = thinkingStartTime ? Date.now() - thinkingStartTime : 0
              updateMessage(currentMessageId, {
                isThinking: false,
                thinkingDurationMs: duration,
              })
            },

            onToolStart: (id, name, input) => {
              const toolCall: ToolCall = {
                id: `tool-${id}`,
                toolName: name,
                params: input,
                status: 'executing',
                messageId: currentMessageId,
              }
              addToolCall(toolCall)
            },

            onToolResult: (toolUseId, result) => {
              const resultStr = typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2)
              updateToolCall(`tool-${toolUseId}`, {
                status: 'complete',
                summary: resultStr.slice(0, 100) + (resultStr.length > 100 ? '...' : ''),
                fullResult: resultStr,
              })
            },

            onUsage: (tokens) => {
              updateTokenCount(tokens)
            },

            onComplete: (stats) => {
              // Save session for future resumption
              if (stats.sessionId && currentThreadId) {
                setClaudeSession(currentThreadId, stats.sessionId)
              }
              updateMessage(currentMessageId, { isComplete: true, isStreaming: false })
            },

            onError: (error) => {
              updateMessage(currentMessageId, {
                content: `Error: ${error.message}`,
                variant: 'error',
                isComplete: true,
                isStreaming: false,
              })
            },
          })

          // Handle abort
          if (abortController.signal.aborted) {
            claudeService.cancel()
          }
        } else if (useCodexPath) {
          // Codex CLI headless path - Codex handles tools internally

          await codexService.send(content, {
            model: process.env.SONDER_CODEX_MODEL || '', // Let Codex use its default model

            onText: (text) => {
              appendToStreamingMessage(text)
              updateTokenCount(Math.ceil(text.length / 4))
            },

            onToolStart: (id, name, input) => {
              const toolCall: ToolCall = {
                id: `tool-${id}`,
                toolName: name,
                params: input,
                status: 'executing',
                messageId: currentMessageId,
              }
              addToolCall(toolCall)
            },

            onToolResult: (toolUseId, result) => {
              const resultStr = typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2)
              updateToolCall(`tool-${toolUseId}`, {
                status: 'complete',
                summary: resultStr.slice(0, 100) + (resultStr.length > 100 ? '...' : ''),
                fullResult: resultStr,
              })
            },

            onUsage: (tokens) => {
              updateTokenCount(tokens)
            },

            onComplete: () => {
              updateMessage(currentMessageId, { isComplete: true, isStreaming: false })
            },

            onError: (error) => {
              updateMessage(currentMessageId, {
                content: `Error: ${error.message}`,
                variant: 'error',
                isComplete: true,
                isStreaming: false,
              })
            },
          })

          // Handle abort
          if (abortController.signal.aborted) {
            codexService.cancel()
          }
        } else {
          // OpenRouter path - existing implementation
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

          // Agentic tool call loop - continues until taskComplete or abort
          let continueLoop = true

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
            // Check if there are pending subgoals before stopping
            const subgoals = Object.values(useSubgoalStore.getState().subgoals)
            const pendingSubgoals = subgoals.filter(s => s.status !== 'completed')

            if (pendingSubgoals.length > 0) {
              // Model tried to stop but there's pending work - nudge it to continue
              chatMessages.push({
                role: 'user',
                content: `You have ${pendingSubgoals.length} pending subgoal(s):\n` +
                  pendingSubgoals.map(s => `- ${s.objective}`).join('\n') +
                  `\n\nExecute "${pendingSubgoals[0].objective}" now, then call strikeSubgoal("${pendingSubgoals[0].id}").`,
              })

              // Create new message for continued response
              updateMessage(currentMessageId, { isComplete: true, isStreaming: false })
              const continueMessageId = generateId()
              thinkingStartTime = null
              addMessage({
                id: continueMessageId,
                variant: 'ai',
                content: '',
                timestamp: new Date(),
                isComplete: false,
                isStreaming: true,
                isThinking: false,
              })
              currentMessageId = continueMessageId
              setStreamingMessageId(continueMessageId)
              // Don't set continueLoop = false, keep going
            } else {
              continueLoop = false
            }
          }
        }

          updateMessage(currentMessageId, { isComplete: true, isStreaming: false })
          // Link AI message to current thread
          if (currentThreadId) {
            addMessageToThread(currentThreadId, currentMessageId)
            // Check for auto-compact (fire and forget)
            void checkAutoCompact()
          }
        } // end else (OpenRouter path)

        // Link AI message to current thread (for Claude Code / Codex path)
        if ((useClaudeCodePath || useCodexPath) && currentThreadId) {
          addMessageToThread(currentThreadId, currentMessageId)
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
      modelName,
      addMessage,
      updateMessage,
      appendToStreamingMessage,
      appendToThinkingContent,
      setIsStreaming,
      setStreamingMessageId,
      addToolCall,
      updateToolCall,
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
      getClaudeSession,
      setClaudeSession,
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
