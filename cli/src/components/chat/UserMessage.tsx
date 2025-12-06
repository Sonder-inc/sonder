import { useState, useCallback } from 'react'
import { TextAttributes } from '@opentui/core'
import { copyToClipboard } from '../../utils/clipboard'

interface UserMessageProps {
  content: string
}

export const UserMessage = ({ content }: UserMessageProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    void copyToClipboard(content).then((success) => {
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    })
  }, [content])

  return (
    <box style={{ flexDirection: 'column' }} onMouseDown={handleCopy}>
      {copied && <text fg="#22c55e">copied*</text>}
      <text style={{ wrapMode: 'word' }}>
        <span fg="#ffffff" bg="#3f3f46" attributes={TextAttributes.BOLD}>
          {' '}{content}{' '}
        </span>
      </text>
    </box>
  )
}
