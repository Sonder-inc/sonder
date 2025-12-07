import { useState, useCallback, type ReactNode } from 'react'

interface ClickableProps {
  children: ReactNode | ((isHovered: boolean) => ReactNode)
  onClick?: () => void
  disabled?: boolean
}

export const Clickable = ({ children, onClick, disabled }: ClickableProps) => {
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseOver = useCallback(() => {
    if (!disabled) setIsHovered(true)
  }, [disabled])

  const handleMouseOut = useCallback(() => {
    setIsHovered(false)
  }, [])

  const handleMouseDown = useCallback(() => {
    if (!disabled && onClick) onClick()
  }, [disabled, onClick])

  return (
    <box
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onMouseDown={handleMouseDown}
    >
      {typeof children === 'function' ? children(isHovered) : children}
    </box>
  )
}
