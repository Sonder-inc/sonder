import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useTerminalDimensions } from './hooks/use-terminal-dimensions'
import { useChatHandler } from './hooks/use-chat-handler'
import { useAppKeyboard } from './hooks/use-app-keyboard'
import { useSchoolMode } from './hooks/use-school-mode'
import { useChatStore } from './state/chat-store'
import { useThreadStore } from './state/thread-store'
import { useSchoolStore } from './state/school-store'
import { useHackingStore } from './state/hacking-store'
import { useAuthStore } from './state/auth-store'
import { platformManager } from './services/platform'
import { InputBox, type MultilineInputHandle } from './components/input'
import { WelcomeBanner } from './components/welcome-banner'
import { StreamingStatus } from './components/streaming-status'
import { MessageList } from './components/chat/MessageList'
import { ShortcutsPanel } from './components/panels/ShortcutsPanel'
import { CommandPanel } from './components/panels/CommandPanel'
import { ContextPanel } from './components/panels/ContextPanel'
import { SettingsPanel, type SettingsTab } from './components/panels/SettingsPanel'
import { SchoolModePanel } from './components/school'
import { QuestionWizard } from './components/QuestionWizard'
import { Sidebar } from './components/sidebar'
import { HackingSidebar } from './components/sidebar/HackingSidebar'
import { SystemInfo } from './components/SystemInfo'
import { LoginPage } from './components/LoginPage'
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
  // Auth check - show login page if not authenticated
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <AuthenticatedApp initialPrompt={initialPrompt} version={version} launchDir={launchDir} />
}

const AuthenticatedApp = ({ initialPrompt, version, launchDir }: AppProps) => {
  const { terminalWidth } = useTerminalDimensions()
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const inputRef = useRef<MultilineInputHandle | null>(null)
  const [modelIndex, setModelIndex] = useState(0)
  const [modeIndex, setModeIndex] = useState(0)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [initialSettingsTab, setInitialSettingsTab] = useState<SettingsTab>('Config')

  // Auth logout and config panel auto-open
  const logout = useAuthStore((state) => state.logout)
  const shouldOpenConfig = useAuthStore((state) => state.shouldOpenConfig)
  const clearShouldOpenConfig = useAuthStore((state) => state.clearShouldOpenConfig)

  // Auto-open config panel for BYOK users (triggered once after login)
  useEffect(() => {
    if (shouldOpenConfig) {
      setShowSettingsPanel(true)
      setInitialSettingsTab('Config')
      clearShouldOpenConfig()
    }
  }, [shouldOpenConfig, clearShouldOpenConfig])

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

  // Hacking store for hacking mode
  const hackingStore = useHackingStore()

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
    modelName: MODELS[modelIndex],
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
    showSettingsPanel,
    setShowSettingsPanel,
    setInitialSettingsTab,
    addMessage,
    clearMessages,
    messages,
    enterSchoolMode,
    exitSchoolMode,
  })

  // Index of 'school' in the MODES array
  const SCHOOL_MODE_INDEX = 4

  // Feedback handler
  const handleFeedback = useCallback((messageId: string, value: FeedbackValue) => {
    updateMessage(messageId, { feedback: value })
    // TODO: Send feedback to backend/analytics
  }, [updateMessage])

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || isStreaming) {
      return
    }

    // Parse commands
    if (trimmed.startsWith('/')) {
      const command = trimmed.split(' ')[0].toLowerCase()

      switch (command) {
        case '/school':
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

        case '/init': {
          // Initialize sonder in current directory
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

          // Import and call initProjectDirectory
          void (async () => {
            try {
              const { initProjectDirectory, getInitProjectSummary } = await import('./utils/init')
              const result = await initProjectDirectory()
              const summary = getInitProjectSummary(result)

              addMessage({
                id: `sys-${Date.now()}`,
                variant: 'system',
                content: `Project initialized:\n${summary}`,
                timestamp: new Date(),
                isComplete: true,
              })
            } catch (err) {
              addMessage({
                id: `sys-${Date.now()}`,
                variant: 'error',
                content: `Failed to initialize project: ${err}`,
                timestamp: new Date(),
                isComplete: true,
              })
            }
          })()
          return
        }

        case '/status':
          setInitialSettingsTab('Status')
          setShowSettingsPanel(true)
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/context':
          setInitialSettingsTab('Context')
          setShowSettingsPanel(true)
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/usage':
          setInitialSettingsTab('Usage')
          setShowSettingsPanel(true)
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/config':
        case '/theme':
          setInitialSettingsTab('Config')
          setShowSettingsPanel(true)
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

        case '/target': {
          // Set current target for hacking session
          const args = trimmed.slice(command.length).trim().split(/\s+/)
          if (args.length === 0 || !args[0]) {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: 'Usage: /target <ip> [name]',
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: '/target ', cursorPosition: 8, lastEditDueToNav: false })
            return
          }
          const [ip, ...nameParts] = args
          const name = nameParts.join(' ')
          hackingStore.startSession(ip, name || undefined)
          addMessage({
            id: `sys-${Date.now()}`,
            variant: 'system',
            content: `Target set: ${ip}${name ? ` (${name})` : ''}`,
            timestamp: new Date(),
            isComplete: true,
          })
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
        }

        case '/flag': {
          // Mark flag as collected (user/root)
          const args = trimmed.slice(command.length).trim().toLowerCase()
          if (!args || (args !== 'user' && args !== 'root')) {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: 'Usage: /flag <user|root>',
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: '/flag ', cursorPosition: 6, lastEditDueToNav: false })
            return
          }
          if (args === 'user') {
            hackingStore.markUserFlag(true)
          } else {
            hackingStore.markRootFlag(true)
          }
          addMessage({
            id: `sys-${Date.now()}`,
            variant: 'system',
            content: `${args} flag marked as collected!`,
            timestamp: new Date(),
            isComplete: true,
          })
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
        }

        case '/recon': {
          // Add recon finding: /recon <type> <value> [details]
          const args = trimmed.slice(command.length).trim().split(/\s+/)
          if (args.length < 2) {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: 'Usage: /recon <port|service|os|tech|subdomain|directory|vulnerability> <value> [details]',
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: '/recon ', cursorPosition: 7, lastEditDueToNav: false })
            return
          }
          const [type, value, ...detailsParts] = args
          const validTypes = ['port', 'service', 'os', 'tech', 'subdomain', 'directory', 'vulnerability']
          if (!validTypes.includes(type)) {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'error',
              content: `Invalid type "${type}". Valid types: ${validTypes.join(', ')}`,
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: trimmed, cursorPosition: trimmed.length, lastEditDueToNav: false })
            return
          }
          const details = detailsParts.join(' ')
          hackingStore.addFinding({
            type: type as any,
            value,
            details: details || undefined,
          })
          addMessage({
            id: `sys-${Date.now()}`,
            variant: 'system',
            content: `Recon finding added: ${type} - ${value}${details ? ` (${details})` : ''}`,
            timestamp: new Date(),
            isComplete: true,
          })
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
        }

        case '/cred': {
          // Add credential: /cred <type> <value> [user] [service]
          const args = trimmed.slice(command.length).trim().split(/\s+/)
          if (args.length < 2) {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'system',
              content: 'Usage: /cred <username|password|hash|api_key|token|ssh_key|certificate> <value> [user] [service]',
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: '/cred ', cursorPosition: 6, lastEditDueToNav: false })
            return
          }
          const [type, value, user, service] = args
          const validTypes = ['username', 'password', 'hash', 'api_key', 'token', 'ssh_key', 'certificate']
          if (!validTypes.includes(type)) {
            addMessage({
              id: `sys-${Date.now()}`,
              variant: 'error',
              content: `Invalid type "${type}". Valid types: ${validTypes.join(', ')}`,
              timestamp: new Date(),
              isComplete: true,
            })
            setInputValue({ text: trimmed, cursorPosition: trimmed.length, lastEditDueToNav: false })
            return
          }
          hackingStore.addCredential({
            type: type as any,
            value,
            user: user || undefined,
            service: service || undefined,
          })
          addMessage({
            id: `sys-${Date.now()}`,
            variant: 'system',
            content: `Credential added: ${type} - ${value}${user ? ` (${user})` : ''}`,
            timestamp: new Date(),
            isComplete: true,
          })
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
        }

        case '/logout':
          logout()
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return

        case '/doctor':
        case '/agents':
          // TODO: Implement these commands
          setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
          return
      }
    }

    handleSendMessage(trimmed)
    setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  }, [inputValue, isStreaming, handleSendMessage, setInputValue, setModeIndex, setShowSettingsPanel, setInitialSettingsTab, addMessage, version, modeIndex, enterSchoolMode, exitSchoolMode, setQuestionWizard, submitFlag, isSchoolActive, schoolStore, hackingStore, logout])

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
        {/* Banner - fixed at top, collapses after first message */}
        <WelcomeBanner width={mainWidth} mode={MODES[modeIndex]} version={version} machineInfo={launchDir} collapsed={messages.length > 0} smartShortcut={smartShortcut} />

        {/* Messages scrollbox */}
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
          {showSettingsPanel && (
            <SettingsPanel
              model={MODELS[modelIndex]}
              modelId={getModelId(MODELS[modelIndex], thinkingEnabled)}
              mode={MODES[modeIndex]}
              version={version}
              thinkingEnabled={thinkingEnabled}
              initialTab={initialSettingsTab}
              onClose={() => setShowSettingsPanel(false)}
            />
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
      {modeIndex === SCHOOL_MODE_INDEX ? (
        <Sidebar width={sidebarWidth} isSchoolMode={true} showCommands={showCommands} showContext={showContext} />
      ) : (
        <HackingSidebar width={sidebarWidth} showCommands={showCommands} showContext={showContext} />
      )}
    </box>
  )
}
