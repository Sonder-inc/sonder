import { useEffect, useState } from 'react'

interface UseCursorBlinkOptions {
  focused: boolean
  shouldBlink: boolean
  /** Dependencies that reset the blink cycle (e.g., value changes) */
  resetDependencies?: unknown[]
}

/**
 * Hook for cursor blink animation
 * Returns whether the cursor should be visible
 */
export function useCursorBlink({
  focused,
  shouldBlink,
  resetDependencies = [],
}: UseCursorBlinkOptions): boolean {
  const [cursorVisible, setCursorVisible] = useState(true)
  const [lastActivity, setLastActivity] = useState(Date.now())

  // Reset cursor visibility on activity
  useEffect(() => {
    setLastActivity(Date.now())
    setCursorVisible(true)
  }, resetDependencies)

  // Blink cursor effect
  useEffect(() => {
    if (!focused || !shouldBlink) {
      setCursorVisible(true)
      return
    }

    const blinkInterval = setInterval(() => {
      setCursorVisible((prev) => !prev)
    }, 530)

    return () => clearInterval(blinkInterval)
  }, [focused, shouldBlink, lastActivity])

  return cursorVisible
}
