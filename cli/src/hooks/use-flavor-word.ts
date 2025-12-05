import { useCallback, useState } from 'react'
import { getFlavorWord } from '../services/openrouter'

interface UseFlavorWordResult {
  flavorWord: string
  showStatus: boolean
  fetchFlavorWord: (content: string) => Promise<void>
  resetFlavorWord: () => void
}

/**
 * Hook for fetching and managing the flavor word displayed during streaming
 */
export function useFlavorWord(): UseFlavorWordResult {
  const [flavorWord, setFlavorWord] = useState('')
  const [showStatus, setShowStatus] = useState(false)

  const fetchFlavorWord = useCallback(async (content: string) => {
    setShowStatus(false)
    setFlavorWord('')

    const word = await getFlavorWord(content)
    if (word) {
      setFlavorWord(word)
      setShowStatus(true)
    }
  }, [])

  const resetFlavorWord = useCallback(() => {
    setShowStatus(false)
    setFlavorWord('')
  }, [])

  return {
    flavorWord,
    showStatus,
    fetchFlavorWord,
    resetFlavorWord,
  }
}
