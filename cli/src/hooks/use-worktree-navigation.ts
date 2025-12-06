import { useCallback, useMemo } from 'react'
import { useThreadStore } from '../state/thread-store'
import { flattenTree } from '../services/thread-persistence'
import type { Thread } from '../types/thread'

export function useWorktreeNavigation() {
  const threadTree = useThreadStore((state) => state.threadTree)
  const selectedThreadId = useThreadStore((state) => state.selectedThreadId)
  const setSelectedThreadId = useThreadStore((state) => state.setSelectedThreadId)
  const currentThreadId = useThreadStore((state) => state.currentThreadId)

  // Flatten tree to list for navigation
  const flatThreadList = useMemo((): Thread[] => {
    return flattenTree(threadTree)
  }, [threadTree])

  const navigateUp = useCallback(() => {
    if (flatThreadList.length === 0) return

    const currentIndex = selectedThreadId
      ? flatThreadList.findIndex((t) => t.id === selectedThreadId)
      : 0

    const newIndex = currentIndex <= 0 ? flatThreadList.length - 1 : currentIndex - 1

    const newThread = flatThreadList[newIndex]
    if (newThread) {
      setSelectedThreadId(newThread.id)
    }
  }, [flatThreadList, selectedThreadId, setSelectedThreadId])

  const navigateDown = useCallback(() => {
    if (flatThreadList.length === 0) return

    const currentIndex = selectedThreadId
      ? flatThreadList.findIndex((t) => t.id === selectedThreadId)
      : -1

    const newIndex = (currentIndex + 1) % flatThreadList.length

    const newThread = flatThreadList[newIndex]
    if (newThread) {
      setSelectedThreadId(newThread.id)
    }
  }, [flatThreadList, selectedThreadId, setSelectedThreadId])

  const initializeSelection = useCallback(() => {
    // If no selection, select current thread or first thread
    if (!selectedThreadId && flatThreadList.length > 0) {
      const current = flatThreadList.find((t) => t.id === currentThreadId)
      setSelectedThreadId(current?.id ?? flatThreadList[0]?.id ?? null)
    }
  }, [selectedThreadId, flatThreadList, currentThreadId, setSelectedThreadId])

  return {
    navigateUp,
    navigateDown,
    initializeSelection,
    hasThreads: flatThreadList.length > 0,
    selectedThreadId,
    setSelectedThreadId,
  }
}
