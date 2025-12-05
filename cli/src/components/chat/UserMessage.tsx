import { TextAttributes } from '@opentui/core'

interface UserMessageProps {
  content: string
}

export const UserMessage = ({ content }: UserMessageProps) => {
  return (
    <text style={{ wrapMode: 'word' }}>
      <span fg="#ffffff" bg="#3f3f46" attributes={TextAttributes.BOLD}>
        {' '}{content}{' '}
      </span>
    </text>
  )
}
