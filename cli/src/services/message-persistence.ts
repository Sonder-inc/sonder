import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs'
import { SONDER_HOME } from '../utils/user-config'
import type { ChatMessage } from '../types/chat'

export const MESSAGES_DIR = join(SONDER_HOME, 'messages')

// Serializable version of ChatMessage (Date -> string)
interface StoredMessage {
  id: string
  variant: ChatMessage['variant']
  content: string
  timestamp: string
  isComplete: boolean
  isStreaming?: boolean
  isInterrupted?: boolean
  feedback?: ChatMessage['feedback']
}

function ensureMessagesDir(): void {
  if (!existsSync(MESSAGES_DIR)) {
    mkdirSync(MESSAGES_DIR, { recursive: true })
  }
}

function toStored(msg: ChatMessage): StoredMessage {
  return {
    ...msg,
    timestamp: msg.timestamp.toISOString(),
  }
}

function fromStored(stored: StoredMessage): ChatMessage {
  return {
    ...stored,
    timestamp: new Date(stored.timestamp),
  }
}

export function saveMessage(message: ChatMessage): void {
  ensureMessagesDir()
  const filePath = join(MESSAGES_DIR, `${message.id}.json`)
  writeFileSync(filePath, JSON.stringify(toStored(message), null, 2))
}

export function loadMessage(messageId: string): ChatMessage | null {
  const filePath = join(MESSAGES_DIR, `${messageId}.json`)
  if (!existsSync(filePath)) return null

  try {
    const stored = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredMessage
    return fromStored(stored)
  } catch {
    return null
  }
}

export function loadMessages(messageIds: string[]): ChatMessage[] {
  return messageIds
    .map((id) => loadMessage(id))
    .filter((m): m is ChatMessage => m !== null)
}

export function deleteMessage(messageId: string): void {
  const filePath = join(MESSAGES_DIR, `${messageId}.json`)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

/**
 * Get all messages for a thread, including inherited messages from parent chain
 * Messages are ordered chronologically
 */
export function getThreadMessages(
  threadId: string,
  threads: Map<string, { messageIds: string[]; parentThreadId?: string; forkPointMessageId?: string }>
): ChatMessage[] {
  const thread = threads.get(threadId)
  if (!thread) return []

  // Build chain of parent threads
  const chain: Array<{ messageIds: string[]; forkPointMessageId?: string }> = []
  let current: { messageIds: string[]; parentThreadId?: string; forkPointMessageId?: string } | undefined = thread

  while (current) {
    chain.unshift({ messageIds: current.messageIds, forkPointMessageId: current.forkPointMessageId })
    if (current.parentThreadId) {
      current = threads.get(current.parentThreadId)
    } else {
      break
    }
  }

  // Collect messages, respecting fork points
  const allMessageIds: string[] = []

  for (let i = 0; i < chain.length; i++) {
    const segment = chain[i]
    const nextSegment = chain[i + 1]

    if (nextSegment?.forkPointMessageId) {
      // Only include messages up to the fork point
      const forkIndex = segment.messageIds.indexOf(nextSegment.forkPointMessageId)
      if (forkIndex !== -1) {
        allMessageIds.push(...segment.messageIds.slice(0, forkIndex + 1))
      } else {
        allMessageIds.push(...segment.messageIds)
      }
    } else {
      allMessageIds.push(...segment.messageIds)
    }
  }

  return loadMessages(allMessageIds)
}
