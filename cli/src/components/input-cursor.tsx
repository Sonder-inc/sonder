import { useEffect, useState } from 'react'

const CURSOR_CHAR = '\u2588' // Full block character
const BLINK_INTERVAL_MS = 530

interface InputCursorProps {
  visible?: boolean
  focused?: boolean
  shouldBlink?: boolean
  color?: string
}

export const InputCursor = ({
  visible = true,
  focused = true,
  shouldBlink = true,
  color = '#3b82f6',
}: InputCursorProps) => {
  const [isBlinkVisible, setIsBlinkVisible] = useState(true)

  useEffect(() => {
    if (!shouldBlink || !focused) {
      setIsBlinkVisible(true)
      return
    }

    const interval = setInterval(() => {
      setIsBlinkVisible((prev) => !prev)
    }, BLINK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [shouldBlink, focused])

  if (!visible) {
    return null
  }

  const showCursor = focused ? isBlinkVisible : true

  return (
    <span fg={showCursor ? color : 'transparent'}>
      {CURSOR_CHAR}
    </span>
  )
}
