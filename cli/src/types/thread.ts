export type ThreadStatus = 'visited' | 'current' | 'handoff'
export type ThreadType = 'root' | 'fork' | 'compact' | 'handoff'

export interface ThreadStats {
  additions: number
  changes: number
  deletions: number
}

export interface Thread {
  id: string
  title: string
  createdAt: string // ISO date string
  lastActivityAt: string
  messageCount: number

  // Thread tree structure
  parentThreadId?: string
  forkPointMessageId?: string // Message ID where fork happened
  childThreadIds: string[]

  // Metadata
  stats: ThreadStats
  status: ThreadStatus
  type: ThreadType

  // Messages belonging to this thread (not inherited from parent)
  messageIds: string[]

  // Token tracking for auto-compact
  tokenCount?: number // Approximate tokens in this thread's messages
}

// Auto-compact settings
export const AUTO_COMPACT_THRESHOLD = 50000 // Trigger auto-compact at ~50k tokens
export const CONTEXT_BUFFER_SIZE = 10000 // Keep ~10k tokens of recent context

export interface ThreadTreeNode {
  thread: Thread
  children: ThreadTreeNode[]
  depth: number
  isExpanded: boolean
}
