import { useCallback, useRef, useState } from 'react'

interface UseStreamingResult {
  isStreamingLocal: boolean
  streamStartTime: number
  tokenCount: number
  abortControllerRef: React.MutableRefObject<AbortController | null>
  startStreaming: () => AbortController
  updateTokenCount: (count: number) => void
  endStreaming: () => void
  cancelStream: () => void
}

/**
 * Hook for managing streaming state and cancellation
 */
export function useStreaming(): UseStreamingResult {
  const [isStreamingLocal, setIsStreamingLocal] = useState(false)
  const [streamStartTime, setStreamStartTime] = useState(0)
  const [tokenCount, setTokenCount] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const startStreaming = useCallback(() => {
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setIsStreamingLocal(true)
    setStreamStartTime(Date.now())
    setTokenCount(0)
    return abortController
  }, [])

  const updateTokenCount = useCallback((count: number) => {
    setTokenCount(count)
  }, [])

  const endStreaming = useCallback(() => {
    setIsStreamingLocal(false)
    abortControllerRef.current = null
  }, [])

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    isStreamingLocal,
    streamStartTime,
    tokenCount,
    abortControllerRef,
    startStreaming,
    updateTokenCount,
    endStreaming,
    cancelStream,
  }
}
