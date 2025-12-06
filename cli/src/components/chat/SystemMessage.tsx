import { TextAttributes } from '@opentui/core'
import { useTheme } from '../../hooks/use-theme'

interface SystemMessageProps {
  content: string
}

export const SystemMessage = ({ content }: SystemMessageProps) => {
  const theme = useTheme()

  return (
    <text style={{ wrapMode: 'word' }}>
      <span fg={theme.muted} attributes={TextAttributes.DIM}>
        {content}
      </span>
    </text>
  )
}
