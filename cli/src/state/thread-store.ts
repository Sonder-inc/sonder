import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import type { Thread, ThreadTreeNode } from '../types/thread'
import { AUTO_COMPACT_THRESHOLD } from '../types/thread'
import {
  saveThread,
  loadAllThreads,
  deleteThread as deleteThreadFile,
  buildThreadTree,
} from '../services/thread-persistence'
import { loadMessage, loadMessages } from '../services/message-persistence'
import { generateConversationSummary } from '../services/openrouter'

// Simple token estimation: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export type ThreadStoreState = {
  threads: Thread[]
  currentThreadId: string | null
  selectedThreadId: string | null // For worktree panel navigation
  threadTree: ThreadTreeNode[]
  loaded: boolean
}

type ThreadStoreActions = {
  loadThreads: () => void
  createThread: (title?: string) => string // Returns new thread ID
  switchThread: (threadId: string) => void
  forkThread: (parentThreadId: string, forkPointMessageId: string) => string
  compactThread: () => Promise<{ threadId: string; summary: string }> // Creates new compact block after current with auto-summary
  updateThreadStats: (
    threadId: string,
    stats: Partial<{ additions: number; changes: number; deletions: number }>
  ) => void
  updateThreadActivity: (threadId: string) => void
  setSelectedThreadId: (threadId: string | null) => void
  deleteThread: (threadId: string) => void
  getCurrentThread: () => Thread | null
  addMessageToThread: (threadId: string, messageId: string) => void
  setThreadTitle: (threadId: string, title: string) => void
  getThreadMessageIds: (threadId: string) => string[] // Get all message IDs including inherited
  getTotalTokenCount: (threadId: string) => number // Get total tokens for thread including inherited
  checkAutoCompact: () => Promise<boolean> // Check if auto-compact should trigger, returns true if compacted
}

type ThreadStore = ThreadStoreState & ThreadStoreActions

const initialState: ThreadStoreState = {
  threads: [],
  currentThreadId: null,
  selectedThreadId: null,
  threadTree: [],
  loaded: false,
}

export const useThreadStore = create<ThreadStore>()(
  immer((set, get) => ({
    ...initialState,

    loadThreads: () => {
      const threads = loadAllThreads()
      let threadTree = buildThreadTree(threads)

      // Find current thread or create first one
      let currentThreadId = threads.find((t) => t.status === 'current')?.id

      if (!currentThreadId && threads.length === 0) {
        // Create initial thread
        const firstThread: Thread = {
          id: nanoid(),
          title: 'Initial conversation',
          createdAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          messageCount: 0,
          childThreadIds: [],
          stats: { additions: 0, changes: 0, deletions: 0 },
          status: 'current',
          type: 'root',
          messageIds: [],
        }
        saveThread(firstThread)
        threads.push(firstThread)
        currentThreadId = firstThread.id
        threadTree = buildThreadTree(threads)
      }

      set((state) => {
        state.threads = threads
        state.currentThreadId = currentThreadId || null
        state.selectedThreadId = currentThreadId || null
        state.threadTree = threadTree
        state.loaded = true
      })
    },

    createThread: (title = 'New conversation') => {
      const thread: Thread = {
        id: nanoid(),
        title,
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        messageCount: 0,
        childThreadIds: [],
        stats: { additions: 0, changes: 0, deletions: 0 },
        status: 'visited',
        type: 'root',
        messageIds: [],
      }

      saveThread(thread)

      set((state) => {
        state.threads.push(thread)
        state.threadTree = buildThreadTree(state.threads)
      })

      return thread.id
    },

    switchThread: (threadId) => {
      const threads = get().threads
      const thread = threads.find((t) => t.id === threadId)
      if (!thread) return

      set((state) => {
        // Mark old thread as visited
        const oldThread = state.threads.find((t) => t.id === state.currentThreadId)
        if (oldThread && oldThread.id !== threadId) {
          oldThread.status = 'visited'
          saveThread(oldThread)
        }

        // Mark new thread as current
        const newThread = state.threads.find((t) => t.id === threadId)
        if (newThread) {
          newThread.status = 'current'
          saveThread(newThread)
        }

        state.currentThreadId = threadId
        state.threadTree = buildThreadTree(state.threads)
      })
    },

    forkThread: (parentThreadId, forkPointMessageId) => {
      const parent = get().threads.find((t) => t.id === parentThreadId)
      if (!parent) return ''

      const forkedThread: Thread = {
        id: nanoid(),
        title: `Fork: ${parent.title.substring(0, 20)}...`,
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        messageCount: 0,
        parentThreadId,
        forkPointMessageId,
        childThreadIds: [],
        stats: { additions: 0, changes: 0, deletions: 0 },
        status: 'current',
        type: 'fork',
        messageIds: [], // New messages will be added here
      }

      saveThread(forkedThread)

      set((state) => {
        // Update parent to include child
        const parentThread = state.threads.find((t) => t.id === parentThreadId)
        if (parentThread) {
          parentThread.childThreadIds.push(forkedThread.id)
          parentThread.status = 'visited'
          saveThread(parentThread)
        }

        // Mark old current as visited (if different from parent)
        const oldCurrent = state.threads.find(
          (t) => t.status === 'current' && t.id !== parentThreadId
        )
        if (oldCurrent) {
          oldCurrent.status = 'visited'
          saveThread(oldCurrent)
        }

        state.threads.push(forkedThread)
        state.currentThreadId = forkedThread.id
        state.threadTree = buildThreadTree(state.threads)
      })

      return forkedThread.id
    },

    compactThread: async () => {
      const currentId = get().currentThreadId
      const current = get().threads.find((t) => t.id === currentId)
      if (!current) return { threadId: '', summary: '' }

      // Get all message IDs for current thread (including inherited)
      const messageIds = get().getThreadMessageIds(currentId!)

      // Generate summary from conversation
      let summary = 'Previous conversation compacted.'
      if (messageIds.length > 0) {
        const messages = loadMessages(messageIds)
        const conversationText = messages
          .map((m) => `${m.variant === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 200)}`)
          .join('\n')
        summary = await generateConversationSummary(conversationText)
      }

      // Update the current thread's title with the summary
      set((state) => {
        const currentThread = state.threads.find((t) => t.id === currentId)
        if (currentThread) {
          currentThread.title = summary
          saveThread(currentThread)
        }
      })

      const compactedThread: Thread = {
        id: nanoid(),
        title: 'New conversation',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        messageCount: 0,
        parentThreadId: currentId || undefined,
        childThreadIds: [],
        stats: { additions: 0, changes: 0, deletions: 0 },
        status: 'current',
        type: 'compact',
        messageIds: [],
      }

      saveThread(compactedThread)

      set((state) => {
        // Update current to include child and mark as visited
        const currentThread = state.threads.find((t) => t.id === currentId)
        if (currentThread) {
          currentThread.childThreadIds.push(compactedThread.id)
          currentThread.status = 'visited'
          saveThread(currentThread)
        }

        state.threads.push(compactedThread)
        state.currentThreadId = compactedThread.id
        state.threadTree = buildThreadTree(state.threads)
      })

      return { threadId: compactedThread.id, summary }
    },

    updateThreadStats: (threadId, stats) => {
      set((state) => {
        const thread = state.threads.find((t) => t.id === threadId)
        if (thread) {
          // Accumulate stats rather than replace
          thread.stats.additions += stats.additions || 0
          thread.stats.changes += stats.changes || 0
          thread.stats.deletions += stats.deletions || 0
          saveThread(thread)
          state.threadTree = buildThreadTree(state.threads)
        }
      })
    },

    updateThreadActivity: (threadId) => {
      set((state) => {
        const thread = state.threads.find((t) => t.id === threadId)
        if (thread) {
          thread.lastActivityAt = new Date().toISOString()
          thread.messageCount += 1
          saveThread(thread)
          state.threadTree = buildThreadTree(state.threads)
        }
      })
    },

    setSelectedThreadId: (threadId) => {
      set((state) => {
        state.selectedThreadId = threadId
      })
    },

    deleteThread: (threadId) => {
      deleteThreadFile(threadId)
      set((state) => {
        // Remove from parent's childThreadIds
        const thread = state.threads.find((t) => t.id === threadId)
        if (thread?.parentThreadId) {
          const parent = state.threads.find((t) => t.id === thread.parentThreadId)
          if (parent) {
            parent.childThreadIds = parent.childThreadIds.filter((id) => id !== threadId)
            saveThread(parent)
          }
        }

        state.threads = state.threads.filter((t) => t.id !== threadId)

        // If deleted current thread, switch to first available
        if (state.currentThreadId === threadId) {
          const newCurrent = state.threads[0]
          if (newCurrent) {
            newCurrent.status = 'current'
            saveThread(newCurrent)
            state.currentThreadId = newCurrent.id
          } else {
            state.currentThreadId = null
          }
        }

        state.threadTree = buildThreadTree(state.threads)
      })
    },

    getCurrentThread: () => {
      const currentId = get().currentThreadId
      return get().threads.find((t) => t.id === currentId) || null
    },

    addMessageToThread: (threadId, messageId) => {
      // Load message to get token count
      const message = loadMessage(messageId)
      const messageTokens = message ? estimateTokens(message.content) : 0

      set((state) => {
        const thread = state.threads.find((t) => t.id === threadId)
        if (thread) {
          thread.messageIds.push(messageId)
          thread.lastActivityAt = new Date().toISOString()
          thread.messageCount = thread.messageIds.length
          thread.tokenCount = (thread.tokenCount || 0) + messageTokens
          saveThread(thread)
          state.threadTree = buildThreadTree(state.threads)
        }
      })
    },

    setThreadTitle: (threadId, title) => {
      set((state) => {
        const thread = state.threads.find((t) => t.id === threadId)
        if (thread) {
          thread.title = title
          saveThread(thread)
          state.threadTree = buildThreadTree(state.threads)
        }
      })
    },

    getThreadMessageIds: (threadId) => {
      const threads = get().threads
      const threadMap = new Map(threads.map((t) => [t.id, t]))
      const thread = threadMap.get(threadId)
      if (!thread) return []

      // Build chain of parent threads (oldest first)
      const chain: Thread[] = []
      let current: Thread | undefined = thread

      while (current) {
        chain.unshift(current)
        current = current.parentThreadId ? threadMap.get(current.parentThreadId) : undefined
      }

      // Collect messages, respecting fork points
      const allMessageIds: string[] = []

      for (let i = 0; i < chain.length; i++) {
        const segment = chain[i]
        const nextSegment = chain[i + 1]

        if (nextSegment?.forkPointMessageId) {
          // Only include messages up to and including the fork point
          const forkIndex = segment.messageIds.indexOf(nextSegment.forkPointMessageId)
          if (forkIndex !== -1) {
            allMessageIds.push(...segment.messageIds.slice(0, forkIndex + 1))
          } else {
            // Fork point not found in this segment, include all
            allMessageIds.push(...segment.messageIds)
          }
        } else {
          // No fork point, include all messages from this segment
          allMessageIds.push(...segment.messageIds)
        }
      }

      return allMessageIds
    },

    getTotalTokenCount: (threadId) => {
      const threads = get().threads
      const threadMap = new Map(threads.map((t) => [t.id, t]))
      const thread = threadMap.get(threadId)
      if (!thread) return 0

      // Sum token counts up the parent chain
      let totalTokens = 0
      let current: Thread | undefined = thread

      while (current) {
        totalTokens += current.tokenCount || 0
        current = current.parentThreadId ? threadMap.get(current.parentThreadId) : undefined
      }

      return totalTokens
    },

    checkAutoCompact: async () => {
      const currentId = get().currentThreadId
      if (!currentId) return false

      const totalTokens = get().getTotalTokenCount(currentId)

      if (totalTokens >= AUTO_COMPACT_THRESHOLD) {
        // Trigger auto-compact
        await get().compactThread()
        return true
      }

      return false
    },
  }))
)
