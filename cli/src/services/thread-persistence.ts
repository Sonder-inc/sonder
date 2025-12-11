import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs'
import { SONDER_HOME } from '../utils/user-config'
import type { Thread, ThreadTreeNode } from '../types/thread'

export const THREADS_DIR = join(SONDER_HOME, 'threads')

function ensureThreadsDir(): void {
  if (!existsSync(THREADS_DIR)) {
    mkdirSync(THREADS_DIR, { recursive: true })
  }
}

export function saveThread(thread: Thread): void {
  ensureThreadsDir()
  const filePath = join(THREADS_DIR, `${thread.id}.json`)
  writeFileSync(filePath, JSON.stringify(thread, null, 2))
}

export function loadThread(threadId: string): Thread | null {
  const filePath = join(THREADS_DIR, `${threadId}.json`)
  if (!existsSync(filePath)) return null

  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as Thread
  } catch {
    return null
  }
}

export function loadAllThreads(): Thread[] {
  ensureThreadsDir()
  const files = readdirSync(THREADS_DIR).filter((f) => f.endsWith('.json'))

  return files
    .map((f) => loadThread(f.replace('.json', '')))
    .filter((t): t is Thread => t !== null)
}

export function deleteThread(threadId: string): void {
  const filePath = join(THREADS_DIR, `${threadId}.json`)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

/**
 * Build a tree structure from flat thread list
 * Sorts by lastActivityAt (most recent first)
 * Expands path to current thread so it's always visible
 */
export function buildThreadTree(threads: Thread[]): ThreadTreeNode[] {
  const threadMap = new Map(threads.map((t) => [t.id, t]))
  const roots: ThreadTreeNode[] = []

  // Find current thread and build set of ancestor IDs to keep expanded
  const currentThread = threads.find((t) => t.status === 'current')
  const expandedIds = new Set<string>()

  if (currentThread) {
    // Walk up from current to root, marking all ancestors as expanded
    let t: Thread | undefined = currentThread
    while (t) {
      expandedIds.add(t.id)
      t = t.parentThreadId ? threadMap.get(t.parentThreadId) : undefined
    }
  }

  const buildNode = (thread: Thread, depth: number): ThreadTreeNode => ({
    thread,
    children: thread.childThreadIds
      .map((id) => threadMap.get(id))
      .filter((t): t is Thread => t !== undefined)
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
      .map((child) => buildNode(child, depth + 1)),
    depth,
    isExpanded: expandedIds.has(thread.id) || depth < 2, // Expand path to current + first 2 levels
  })

  // Get root threads (no parent) and sort by activity
  threads
    .filter((t) => !t.parentThreadId)
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
    .forEach((root) => roots.push(buildNode(root, 0)))

  return roots
}

/**
 * Flatten tree to list for navigation (respects expansion state)
 */
export function flattenTree(nodes: ThreadTreeNode[]): Thread[] {
  const result: Thread[] = []

  const flatten = (nodeList: ThreadTreeNode[]): void => {
    for (const node of nodeList) {
      result.push(node.thread)
      if (node.isExpanded && node.children.length > 0) {
        flatten(node.children)
      }
    }
  }

  flatten(nodes)
  return result
}

/**
 * Get time ago string from ISO date
 */
export function getTimeAgo(isoDate: string): string {
  const now = new Date()
  const then = new Date(isoDate)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}

export function getRecentThreads(threads: Thread[], limit: number = 3): Thread[] {
  return [...threads]
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
    .slice(0, limit)
}
