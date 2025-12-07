import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useTerminalDimensions } from './hooks/use-terminal-dimensions'
import { useChatHandler } from './hooks/use-chat-handler'
import { useAppKeyboard } from './hooks/use-app-keyboard'
import { useSchoolMode } from './hooks/use-school-mode'
import { useChatStore } from './state/chat-store'
import { useThreadStore } from './state/thread-store'
import { useSchoolStore } from './state/school-store'
import { platformManager } from './services/platform'
import { InputBox, type MultilineInputHandle } from './components/input'
import { WelcomeBanner } from './components/welcome-banner'
import { StreamingStatus } from './components/streaming-status'
import { MessageList } from './components/chat/MessageList'
import { ShortcutsPanel } from './components/panels/ShortcutsPanel'
import { CommandPanel } from './components/panels/CommandPanel'
import { ContextPanel } from './components/panels/ContextPanel'
import { StatusPanel } from './components/panels/StatusPanel'
import { ConfigPanel } from './components/panels/ConfigPanel'
import { SchoolModePanel } from './components/school'
import { QuestionWizard } from './components/QuestionWizard'
import { Sidebar } from './components/Sidebar'
import { SystemInfo } from './components/SystemInfo'
import { MODELS, MODES, getModelId } from './constants/app-constants'
import { createSupportTicket } from './services/support'
import type { ScrollBoxRenderable } from '@opentui/core'
import type { FeedbackValue, ChatMessage } from './types/chat'

interface AppProps {
  initialPrompt: string | null
  version: string
  launchDir: string
}

export const App = ({ initialPrompt, version, launchDir }: AppProps) => {
  const { terminalWidth } = useTerminalDimensions()
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const inputRef = useRef<MultilineInputHandle | null>(null)
  const [modelIndex, setModelIndex] = useState(0)
  const [modeIndex, setModeIndex] = useState(0)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const [showConfigPanel, setShowConfigPanel] = useState(false)

  // Thread store - load on mount
  const loadThreads = useThreadStore((state) => state.loadThreads)
  const threadsLoaded = useThreadStore((state) => state.loaded)
  const currentThreadId = useThreadStore((state) => state.currentThreadId)
  const addMessageToThread = useThreadStore((state) => state.addMessageToThread)
  const getThreadMessageIds = useThreadStore((state) => state.getThreadMessageIds)

  // Chat store - load messages for thread
  const loadMessagesForThread = useChatStore((state) => state.loadMessagesForThread)

  useEffect(() => {
    if (!threadsLoaded) {
      loadThreads()
    }
  }, [loadThreads, threadsLoaded])

  // Load messages when thread changes
  useEffect(() => {
    if (threadsLoaded && currentThreadId) {
      const messageIds = getThreadMessageIds(currentThreadId)
      loadMessagesForThread(messageIds)
    }
  }, [threadsLoaded, currentThreadId, getThreadMessageIds, loadMessagesForThread])

  // School mode
  const {
    state: schoolState,
    enterSchoolMode,
    exitSchoolMode,
    selectPlatform,
    selectMachine,
    submitFlag,
    isActive: isSchoolActive,
  } = useSchoolMode()

  // School store for progress tracking
  const schoolStore = useSchoolStore()

  const {
    messages,
    addMessage,
    updateMessage,
    appendToStreamingMessage,
    appendToThinkingContent,
    inputValue,
    cursorPosition,
    setInputValue,
    inputFocused,
    isStreaming,
    setIsStreaming,
    setStreamingMessageId,
    toolCalls,
    addToolCall,
    updateToolCall,
    expandedToolId,
    toggleExpandedTool,
    expandedThinkingId,
    toggleExpandedThinking,
    smartShortcut,
    setSmartShortcut,
    incrementUserMessageCount,
    clearMessages,
    questionWizard,
    setQuestionWizard,
  } = useChatStore(
    useShallow((store) => ({
      messages: store.messages,
      addMessage: store.addMessage,
      updateMessage: store.updateMessage,
      appendToStreamingMessage: store.appendToStreamingMessage,
      appendToThinkingContent: store.appendToThinkingContent,
      inputValue: store.inputValue,
      cursorPosition: store.cursorPosition,
      setInputValue: store.setInputValue,
      inputFocused: store.inputFocused,
      isStreaming: store.isStreaming,
      setIsStreaming: store.setIsStreaming,
      setStreamingMessageId: store.setStreamingMessageId,
      toolCalls: store.toolCalls,
      addToolCall: store.addToolCall,
      updateToolCall: store.updateToolCall,
      expandedToolId: store.expandedToolId,
      toggleExpandedTool: store.toggleExpandedTool,
      expandedThinkingId: store.expandedThinkingId,
      toggleExpandedThinking: store.toggleExpandedThinking,
      smartShortcut: store.smartShortcut,
      setSmartShortcut: store.setSmartShortcut,
      incrementUserMessageCount: store.incrementUserMessageCount,
      clearMessages: store.clearMessages,
      questionWizard: store.questionWizard,
      setQuestionWizard: store.setQuestionWizard,
    })),
  )

  // Chat handling logic
  const {
    handleSendMessage,
    flavorWord,
    showStatus,
    streamStartTime,
    tokenCount,
    cancelStream,
  } = useChatHandler({
    model: getModelId(MODELS[modelIndex], thinkingEnabled),
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
  })

  // Keyboard handling logic
  const {
    handleKeyIntercept,
    showShortcuts,
    showCommands,
    showContext,
    selectedMenuIndex,
    pendingExit,
    contextFocusPhase,
    worktreeSelectedId,
    worktreeAction,
  } = useAppKeyboard({
    inputValue,
    setInputValue,
    handleSendMessage,
    isStreaming,
    cancelStream,
    toolCalls,
    toggleExpandedTool,
    modelIndex,
    setModelIndex,
    modeIndex,
    setModeIndex,
    thinkingEnabled,
    setThinkingEnabled,
    smartShortcut,
    setSmartShortcut,
    showStatusPanel,
    setShowStatusPanel,
    showConfigPanel,
    setShowConfigPanel,
    addMessage,
    clearMessages,
    messages,
  })

  // Index of 'school' in the MODES array
  const SCHOOL_MODE_INDEX = 4

  // Feedback handler
  const handleFeedback = useCallback((messageId: string, value: FeedbackValue) => {
    updateMessage(messageId, { feedback: value })
    // TODO: Send feedback to backend/analytics
  }, [updateMessage])

  const handleSubmit = useCallback(() => {
    console.error('[DEBUG 0] handleSubmit called, inputValue:', inputValue.slice(0, 30))
    const trimmed = inputValue.trim()
    if (!trimmed || isStreaming) {
      console.error('[DEBUG 0b] Early return - trimmed:', !!trimmed, 'isStreaming:', isStreaming)
      return
    }

    // Parse commands
    if (trimmed.startsWith('/')) {
      const command = trimmed.split(' ')[0].toLowerCase()

      switch (command) {
        case '/school':
        case '/hack':
          // Toggle school mode - if already in school, exit; otherwise enter
          if (modeIndex === SCHOOL_MODE_INDEX) {
            exitSchoolMode()
            setModeIndex(0)
          } else {
            setModeIndex(SCHOOL_MODE_INDEX)
            enterSchoolMode()
          }
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/exit':
        case '/quit':
          process.exit(0)
          return

        case '/clear':
        case '/reset':
        case '/new': {
          // Create a new root thread and switch to it
          const createThread = useThreadStore.getState().createThread
          const switchThread = useThreadStore.getState().switchThread
          const newThreadId = createThread('New conversation')
          switchThread(newThreadId)
          // Clear UI messages
          clearMessages()
          // Clear terminal screen
          process.stdout.write('\x1b[2J\x1b[H')
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
        }

        case '/init':
          // TODO: Initialize sonder in current directory
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/status':
        case '/context':
          setShowStatusPanel(true)
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/config':
        case '/theme':
          setShowConfigPanel(true)
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/feedback': {
          // Get the description after the command
          const description = trimmed.slice(command.length).trim()
          if (!description) {
            // Show hint that they need to provide a description
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: 'Usage: /feedback <description>',
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: '/feedback ', cursorPosition: 10, lastEditDueToNav: false })
            return
          }

          // Create support ticket with fingerprint
          addMessage({
            id: `sys-${Date.now()}`,
            variant: 'system',
            content: 'Creating support ticket...',
            timestamp: new Date(),
            isComplete: true,
          })
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

          // Fire and forget - create ticket async
          void (async () => {
            const result = await createSupportTicket({
              title: description.slice(0, 80),
              description,
              sonderVersion: version,
            })

            if (result.success) {
              addMessage({
                id: `sys-${Date.now()}`,
                variant: 'system',
                content: `Support ticket created: ${result.issueUrl}`,
                timestamp: new Date(),
                isComplete: true,
              })
            } else {
              addMessage({
                id: `sys-${Date.now()}`,
                variant: 'system',
                content: `Failed to create ticket: ${result.error}`,
                timestamp: new Date(),
                isComplete: true,
              })
            }
          })()
          return
        }

        case '/test-wizard':
          setQuestionWizard({
            questions: [
              {
                id: 'scope',
                header: 'Scope',
                question: 'What scope of implementation do you want?',
                options: [
                  { label: 'Client only', description: 'Connect to external servers' },
                  { label: 'Server only', description: 'Expose as server for other apps' },
                  { label: 'Both', description: 'Full bidirectional support' },
                ],
              },
              {
                id: 'transport',
                header: 'Transport',
                question: 'Which transport protocol?',
                options: [
                  { label: 'stdio', description: 'Standard input/output' },
                  { label: 'HTTP', description: 'REST API over HTTP' },
                ],
              },
            ],
            onComplete: (answers) => {
              // Format answers as a message and send to agent
              const formatted = Object.entries(answers)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n')
              handleSendMessage(`User clarifications:\n${formatted}`)
            },
            onCancel: () => {
              addMessage({
                id: `sys-${Date.now()}`,
                variant: 'system',
                content: 'Wizard cancelled',
                timestamp: new Date(),
                isComplete: true,
              })
            },
          })
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/flag': {
          const flag = trimmed.slice(6).trim()
          if (!flag) {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: 'Usage: /flag <flag>',
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: '/flag ', cursorPosition: 6, lastEditDueToNav: false })
            return
          }

          // Submit flag
          void (async () => {
            const result = await submitFlag(flag)
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: result.correct
                ? `Flag accepted! ${result.message}`
                : `Incorrect flag: ${result.message}`,
              timestamp: new Date(),
              isComplete: true,
            })

            // Update school store progress
            if (result.correct && schoolStore.activeBoxId) {
              if (result.message.toLowerCase().includes('root')) {
                schoolStore.markRootOwned(schoolStore.activeBoxId)
              } else {
                schoolStore.markUserOwned(schoolStore.activeBoxId)
              }
            }
          })()
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
        }

        case '/hint':
          addMessage({
            id: `sys-${Date.now()}`,
            variant: 'system',
            content: 'Requesting hint... (hint system coming soon)',
            timestamp: new Date(),
            isComplete: true,
          })
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/stop': {
          const machineId = schoolStore.activeBoxId
          if (!machineId) {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: 'No active machine to stop',
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
            return
          }

          void (async () => {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: 'Stopping machine...',
              timestamp: new Date(),
              isComplete: true,
            })

            try {
              const result = await platformManager.stopMachine(machineId)
              if (result.success) {
                schoolStore.endSession()
                addMessage({
                  id: `sys-${Date.now()}`,
                  variant: 'system',
                  content: 'Machine stopped',
                  timestamp: new Date(),
                  isComplete: true,
                })
              } else {
                addMessage({
                  id: `sys-${Date.now()}`,
                  variant: 'system',
                  content: `Failed to stop machine: ${result.error}`,
                  timestamp: new Date(),
                  isComplete: true,
                })
              }
            } catch (err) {
              addMessage({
                id: `sys-${Date.now()}`,
                variant: 'system',
                content: `Failed to stop machine: ${err}`,
                timestamp: new Date(),
                isComplete: true,
              })
            }
          })()
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
        }

        case '/doctor':
        case '/login':
        case '/logout':
        case '/add-dir':
        case '/agents':
          // TODO: Implement these commands
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
      }
    }

    handleSendMessage(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  }, [inputValue, isStreaming, handleSendMessage, setInputValue, setModeIndex, setShowStatusPanel, setShowConfigPanel, addMessage, version, modeIndex, enterSchoolMode, exitSchoolMode, setQuestionWizard, submitFlag, isSchoolActive, schoolStore])

  useEffect(() => {
    if (initialPrompt && messages.length === 0) {
      handleSendMessage(initialPrompt)
    }
  }, [])

  // Layout calculations
  const sidebarWidth = Math.max(20, Math.floor(terminalWidth * 0.25))
  const mainWidth = terminalWidth - sidebarWidth - 3

  return (
    <box style={{ flexDirection: 'row', flexGrow: 1, gap: 0 }}>
      {/* Main content column (scrollbox + input) */}
      <box style={{ flexDirection: 'column', flexGrow: 1, width: mainWidth + 2 }}>
        {/* Messages scrollbox - banner is inside and scrolls with messages */}
        <scrollbox
          ref={scrollRef}
          stickyScroll
          stickyStart="bottom"
          scrollX={false}
          scrollbarOptions={{ visible: false }}
          style={{
            flexGrow: 1,
            rootOptions: {
              flexGrow: 1,
              padding: 0,
              gap: 0,
              flexDirection: 'row',
              shouldFill: true,
              backgroundColor: 'transparent',
            },
            wrapperOptions: {
              flexGrow: 1,
              border: false,
              shouldFill: true,
              backgroundColor: 'transparent',
              flexDirection: 'column',
            },
            contentOptions: {
              flexDirection: 'column',
              gap: 0,
              shouldFill: true,
              justifyContent: 'flex-end',
              backgroundColor: 'transparent',
              paddingLeft: 1,
              paddingRight: 1,
            },
          }}
        >
          {/* Banner - scrolls with chat */}
          <WelcomeBanner width={mainWidth} mode={MODES[modeIndex]} version={version} machineInfo={launchDir} />

          {/* Messages */}
          <MessageList
            messages={messages}
            toolCalls={toolCalls}
            expandedToolId={expandedToolId}
            onToggleExpandTool={toggleExpandedTool}
            expandedThinkingId={expandedThinkingId}
            onToggleExpandThinking={toggleExpandedThinking}
            onFeedback={handleFeedback}
          />

          {/* Streaming status with plan - inside scrollbox */}
          {isStreaming && showStatus && flavorWord && (
            <box style={{ marginLeft: 1, marginTop: 1 }}>
              <StreamingStatus
                flavorWord={flavorWord}
                startTime={streamStartTime}
                tokenCount={tokenCount}
                isThinking={messages.find(m => m.isStreaming)?.isThinking}
              />
            </box>
          )}
        </scrollbox>

        {/* Input box */}
        <box style={{ flexDirection: 'column', flexShrink: 0, marginLeft: 1, marginRight: 1, marginBottom: 1 }}>
          <InputBox
            ref={inputRef}
            inputValue={inputValue}
            cursorPosition={cursorPosition}
            setInputValue={setInputValue}
            onSubmit={handleSubmit}
            focused={inputFocused && !isStreaming && !questionWizard}
            width={mainWidth}
            model={MODELS[modelIndex]}
            mode={MODES[modeIndex]}
            thinkingEnabled={thinkingEnabled}
            onKeyIntercept={handleKeyIntercept}
            hintOverride={pendingExit ? 'exit? [^C]' : undefined}
          />

          {/* Panels - shown below input */}
          {showShortcuts && <ShortcutsPanel />}
          {showCommands && <CommandPanel inputValue={inputValue} selectedIndex={selectedMenuIndex} />}
          {showContext && (
            <ContextPanel
              inputValue={inputValue}
              selectedIndex={selectedMenuIndex}
              worktreeSelectedId={worktreeSelectedId}
              focusPhase={contextFocusPhase}
              worktreeAction={worktreeAction}
            />
          )}
          {showStatusPanel && (
            <StatusPanel
              model={MODELS[modelIndex]}
              modelId={getModelId(MODELS[modelIndex], thinkingEnabled)}
              mode={MODES[modeIndex]}
              version={version}
              thinkingEnabled={thinkingEnabled}
            />
          )}
          {showConfigPanel && (
            <ConfigPanel onClose={() => setShowConfigPanel(false)} />
          )}

          {/* School mode panel - shows during setup phases or active session */}
          {modeIndex === SCHOOL_MODE_INDEX && schoolState.phase !== 'idle' && (
            <SchoolModePanel
              state={schoolState}
              onSelectPlatform={selectPlatform}
              onSelectMachine={selectMachine}
              onCancel={exitSchoolMode}
            />
          )}

          {/* Question wizard panel - triggered by interrogator agent */}
          {questionWizard && (
            <QuestionWizard
              questions={questionWizard.questions}
              onComplete={(answers) => {
                questionWizard.onComplete(answers)
                setQuestionWizard(null)
              }}
              onCancel={() => {
                questionWizard.onCancel()
                setQuestionWizard(null)
              }}
            />
          )}

          <SystemInfo />
        </box>
      </box>

      {/* Sidebar - full height */}
      <Sidebar width={sidebarWidth} smartShortcut={smartShortcut} isSchoolMode={modeIndex === SCHOOL_MODE_INDEX} />
    </box>
  )
}
