import { useCallback, useRef } from 'react'
import { getSmartShortcut } from '../services/openrouter'
import type { ChatMessage } from '../types/chat'

interface UseSmartShortcutOptions {
  messages: ChatMessage[]
  setSmartShortcut: (shortcut: string | null) => void
}

interface UseSmartShortcutResult {
  checkAndGenerateShortcut: (userContent: string, messageCount: number) => void
}

/**
 * Hook for generating context-aware shortcuts based on conversation
 */
export function useSmartShortcut({
  messages,
  setSmartShortcut,
}: UseSmartShortcutOptions): UseSmartShortcutResult {
  const pendingRef = useRef(false)

  const checkAndGenerateShortcut = useCallback(
    (userContent: string, messageCount: number) => {
      // Generate smart shortcut every 3 messages
      if (messageCount <= 0 || messageCount % 3 !== 0 || pendingRef.current) {
        return
      }

      pendingRef.current = true

      // Build conversation summary for smart shortcut
      const recentMessages = [
        ...messages.slice(-10),
        { variant: 'user' as const, content: userContent },
      ]
      const summary = recentMessages
        .map((m) => `${m.variant}: ${m.content.slice(0, 200)}`)
        .join('\n')

      // Generate smart shortcut asynchronously
      getSmartShortcut(summary)
        .then((shortcut) => {
          if (shortcut) {
            setSmartShortcut(shortcut)
          }
        })
        .finally(() => {
          pendingRef.current = false
        })
    },
    [messages, setSmartShortcut],
  )

  return { checkAndGenerateShortcut }
}
