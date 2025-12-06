/**
 * Menu Navigation Hook
 *
 * Reusable keyboard navigation logic for menu panels.
 * Handles index bounds, wrapping, and direction.
 */

import { useState, useCallback } from 'react'

export interface UseMenuNavigationOptions {
  /** Total number of items in the menu */
  itemCount: number
  /** Whether to wrap around at boundaries (default: false) */
  wrap?: boolean
  /** Initial selected index (default: 0) */
  initialIndex?: number
}

export interface UseMenuNavigationResult {
  /** Currently selected index */
  selectedIndex: number
  /** Set the selected index directly */
  setSelectedIndex: (index: number | ((prev: number) => number)) => void
  /** Move selection up (decrement) */
  moveUp: () => void
  /** Move selection down (increment) */
  moveDown: () => void
  /** Reset to initial index */
  reset: () => void
  /** Check if at first item */
  isAtStart: boolean
  /** Check if at last item */
  isAtEnd: boolean
}

/**
 * Hook for keyboard-based menu navigation
 */
export function useMenuNavigation({
  itemCount,
  wrap = false,
  initialIndex = 0,
}: UseMenuNavigationOptions): UseMenuNavigationResult {
  const [selectedIndex, setSelectedIndexState] = useState(initialIndex)

  // Clamp to valid range when item count changes
  const clampedIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, itemCount - 1))

  const setSelectedIndex = useCallback((indexOrFn: number | ((prev: number) => number)) => {
    setSelectedIndexState((prev) => {
      const newIndex = typeof indexOrFn === 'function' ? indexOrFn(prev) : indexOrFn
      return Math.min(Math.max(0, newIndex), Math.max(0, itemCount - 1))
    })
  }, [itemCount])

  const moveUp = useCallback(() => {
    setSelectedIndexState((prev) => {
      if (wrap) {
        return (prev - 1 + itemCount) % itemCount
      }
      return Math.max(0, prev - 1)
    })
  }, [itemCount, wrap])

  const moveDown = useCallback(() => {
    setSelectedIndexState((prev) => {
      if (wrap) {
        return (prev + 1) % itemCount
      }
      return Math.min(itemCount - 1, prev + 1)
    })
  }, [itemCount, wrap])

  const reset = useCallback(() => {
    setSelectedIndexState(initialIndex)
  }, [initialIndex])

  return {
    selectedIndex: clampedIndex,
    setSelectedIndex,
    moveUp,
    moveDown,
    reset,
    isAtStart: clampedIndex === 0,
    isAtEnd: clampedIndex === itemCount - 1,
  }
}

/**
 * Utility for cyclic navigation (always wraps)
 */
export function cyclicNav(
  current: number,
  direction: 'up' | 'down',
  count: number
): number {
  if (count <= 0) return 0
  if (direction === 'up') {
    return (current - 1 + count) % count
  }
  return (current + 1) % count
}

/**
 * Utility for bounded navigation (clamps at edges)
 */
export function boundedNav(
  current: number,
  direction: 'up' | 'down',
  count: number
): number {
  if (count <= 0) return 0
  if (direction === 'up') {
    return Math.max(0, current - 1)
  }
  return Math.min(count - 1, current + 1)
}
