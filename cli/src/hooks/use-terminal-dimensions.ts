import { useEffect, useState } from 'react'

export type TerminalDimensions = {
  terminalWidth: number
  terminalHeight: number
  contentMaxWidth: number
  separatorWidth: number
}

export function useTerminalDimensions(): TerminalDimensions {
  const [dimensions, setDimensions] = useState<TerminalDimensions>(() => {
    const width = process.stdout.columns || 80
    const height = process.stdout.rows || 24
    return {
      terminalWidth: width,
      terminalHeight: height,
      contentMaxWidth: Math.min(width - 4, 120),
      separatorWidth: width - 2,
    }
  })

  useEffect(() => {
    const handleResize = () => {
      const width = process.stdout.columns || 80
      const height = process.stdout.rows || 24
      setDimensions({
        terminalWidth: width,
        terminalHeight: height,
        contentMaxWidth: Math.min(width - 4, 120),
        separatorWidth: width - 2,
      })
    }

    process.stdout.on('resize', handleResize)
    return () => {
      process.stdout.off('resize', handleResize)
    }
  }, [])

  return dimensions
}
