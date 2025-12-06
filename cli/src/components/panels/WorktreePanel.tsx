import { useEffect, useState } from 'react'
import { useTheme } from '../../hooks/use-theme'
import { ShimmerText } from '../shimmer-text'
import { useThreadStore } from '../../state/thread-store'
import { getTimeAgo } from '../../services/thread-persistence'
import type { ThreadTreeNode, Thread } from '../../types/thread'

interface WorktreePanelProps {
  selectedThreadId: string | null
  isActive: boolean
}

// Flickering circle for current thread indicator
const FlickerCircle = () => {
  const theme = useTheme()
  const [on, setOn] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => setOn((p) => !p), 500)
    return () => clearInterval(interval)
  }, [])

  return <span fg={on ? theme.success : theme.muted}>●</span>
}

interface FlatThread {
  thread: Thread
  depth: number
  isLast: boolean
  parentIsLast: boolean[] // Track which ancestors are "last" for proper │ vs space
}

export const WorktreePanel = ({ selectedThreadId, isActive }: WorktreePanelProps) => {
  const theme = useTheme()
  const threadTree = useThreadStore((state) => state.threadTree)
  const currentThreadId = useThreadStore((state) => state.currentThreadId)

  // Flatten tree with sibling position info for tree drawing
  const flattenTree = (nodes: ThreadTreeNode[]): FlatThread[] => {
    const result: FlatThread[] = []

    const traverse = (nodeList: ThreadTreeNode[], parentIsLast: boolean[]) => {
      nodeList.forEach((node, idx) => {
        const isLast = idx === nodeList.length - 1
        result.push({
          thread: node.thread,
          depth: node.depth,
          isLast,
          parentIsLast: [...parentIsLast],
        })
        if (node.isExpanded && node.children.length > 0) {
          traverse(node.children, [...parentIsLast, isLast])
        }
      })
    }

    traverse(nodes, [])
    return result
  }

  const flatList = flattenTree(threadTree)

  if (flatList.length === 0) {
    return null
  }

  // Limit display to ~12 items, centered around current/selected thread
  const MAX_VISIBLE = 12
  let visibleList = flatList

  if (flatList.length > MAX_VISIBLE) {
    // Find the index to center on (selected if active, otherwise current)
    const focusId = isActive && selectedThreadId ? selectedThreadId : currentThreadId
    const focusIndex = flatList.findIndex((f) => f.thread.id === focusId)

    if (focusIndex !== -1) {
      // Center the window around focus, but clamp to valid range
      const halfWindow = Math.floor(MAX_VISIBLE / 2)
      let startIndex = Math.max(0, focusIndex - halfWindow)
      const endIndex = Math.min(flatList.length, startIndex + MAX_VISIBLE)

      // Adjust start if we hit the end
      if (endIndex - startIndex < MAX_VISIBLE) {
        startIndex = Math.max(0, endIndex - MAX_VISIBLE)
      }

      visibleList = flatList.slice(startIndex, endIndex)
    } else {
      // Fallback: just show first MAX_VISIBLE
      visibleList = flatList.slice(0, MAX_VISIBLE)
    }
  }

  // Truncate string
  const truncate = (str: string, len: number) =>
    str.length > len ? str.slice(0, len - 1) + '\u2026' : str

  // Build tree prefix like "│ └─" or "  ├─"
  const getTreePrefix = (depth: number, isLast: boolean, parentIsLast: boolean[]) => {
    if (depth === 0) return ''

    let prefix = ''
    // Add vertical lines or spaces for each ancestor level
    for (let i = 0; i < depth - 1; i++) {
      prefix += parentIsLast[i] ? '  ' : '\u2502 ' // "│ " or "  "
    }
    // Add branch connector
    prefix += isLast ? '\u2514\u2500' : '\u251c\u2500' // "└─" or "├─"

    return prefix
  }

  return (
    <box style={{ flexDirection: 'column', marginLeft: 1 }}>
      {visibleList.map(({ thread, depth, isLast, parentIsLast }) => {
        const isSelected = selectedThreadId === thread.id
        const isCurrent = currentThreadId === thread.id

        // Tree prefix
        const prefix = getTreePrefix(depth, isLast, parentIsLast)

        // Label: [init], [cpt], or [fork], or summary if selected
        const label =
          thread.type === 'fork' ? '[fork]' : thread.type === 'root' ? '[init]' : '[cpt]'
        const displayText =
          isSelected && isActive ? truncate(thread.title, 18) + '\u2026' : label

        // Stats
        const { additions: a, changes: c, deletions: d } = thread.stats

        // Short time
        const time = getTimeAgo(thread.lastActivityAt)
          .replace(' ago', '')
          .replace('Just now', 'now')

        return (
          <text key={thread.id}>
            <span fg={theme.muted}>{prefix}</span>
            {isCurrent && <FlickerCircle />}
            {isCurrent && ' '}
            {isSelected && isActive ? (
              <ShimmerText text={displayText} primaryColor={theme.accent} interval={80} />
            ) : (
              <>
                <span fg={isCurrent ? theme.accent : theme.foreground}>{displayText}</span>
                <span fg={theme.success}> +{a}</span>
                <span fg={theme.warning}>~{c}</span>
                <span fg={theme.error}>-{d}</span>
                <span fg={theme.muted}> {time}</span>
              </>
            )}
          </text>
        )
      })}
    </box>
  )
}
