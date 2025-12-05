import { TextAttributes } from '@opentui/core'
import { useTheme } from '../hooks/use-theme'

interface MarkdownProps {
  content: string
}

interface TextSegment {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  heading?: number
  listItem?: boolean
  codeBlock?: boolean
}

/**
 * Simple markdown renderer for terminal
 * Supports: **bold**, *italic*, `code`, ```code blocks```, # headings, - lists
 */
export const Markdown = ({ content }: MarkdownProps) => {
  const theme = useTheme()
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  let inCodeBlock = false
  let codeBlockContent: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <box key={`codeblock-${i}`} style={{ marginTop: 0, marginBottom: 0 }}>
            {codeBlockContent.map((codeLine, j) => (
              <text key={j} style={{ fg: theme.muted }}>
                {'  '}{codeLine}
              </text>
            ))}
          </box>
        )
        codeBlockContent = []
        inCodeBlock = false
      } else {
        // Start code block
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const text = headingMatch[2]
      elements.push(
        <text key={i} style={{ fg: theme.muted }}>
          <span attributes={TextAttributes.BOLD}>{text}</span>
        </text>
      )
      continue
    }

    // List item
    if (line.match(/^[-*]\s+/)) {
      const text = line.replace(/^[-*]\s+/, '')
      elements.push(
        <text key={i} style={{ fg: theme.muted, wrapMode: 'word' }}>
          {'  • '}{renderInlineMarkdown(text, theme)}
        </text>
      )
      continue
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      const match = line.match(/^(\d+)\.\s+(.+)$/)
      if (match) {
        elements.push(
          <text key={i} style={{ fg: theme.muted, wrapMode: 'word' }}>
            {'  '}{match[1]}. {renderInlineMarkdown(match[2], theme)}
          </text>
        )
        continue
      }
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<text key={i}>{' '}</text>)
      continue
    }

    // Regular paragraph
    elements.push(
      <text key={i} style={{ fg: theme.muted, wrapMode: 'word' }}>
        {renderInlineMarkdown(line, theme)}
      </text>
    )
  }

  return <>{elements}</>
}

/**
 * Render inline markdown (bold, italic, code)
 * All text uses theme.muted, only attributes change
 */
function renderInlineMarkdown(text: string, theme: ReturnType<typeof useTheme>): React.ReactNode[] {
  const segments: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/) ||
                      remaining.match(/^(.*?)__(.+?)__(.*)$/)
    if (boldMatch) {
      if (boldMatch[1]) {
        segments.push(...renderInlineMarkdown(boldMatch[1], theme))
      }
      segments.push(
        <span key={key++} attributes={TextAttributes.BOLD} fg={theme.muted}>
          {boldMatch[2]}
        </span>
      )
      remaining = boldMatch[3]
      continue
    }

    // Italic: *text* or _text_ (but not inside words)
    const italicMatch = remaining.match(/^(.*?)\*([^*]+)\*(.*)$/) ||
                        remaining.match(/^(.*?)(?<!\w)_([^_]+)_(?!\w)(.*)$/)
    if (italicMatch) {
      if (italicMatch[1]) {
        segments.push(...renderInlineMarkdown(italicMatch[1], theme))
      }
      segments.push(
        <span key={key++} attributes={TextAttributes.DIM} fg={theme.muted}>
          {italicMatch[2]}
        </span>
      )
      remaining = italicMatch[3]
      continue
    }

    // Inline code: `text`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/)
    if (codeMatch) {
      if (codeMatch[1]) {
        segments.push(<span key={key++}>{codeMatch[1]}</span>)
      }
      segments.push(
        <span key={key++} fg={theme.muted}>
          {codeMatch[2]}
        </span>
      )
      remaining = codeMatch[3]
      continue
    }

    // No more matches, add remaining text
    segments.push(<span key={key++}>{remaining}</span>)
    break
  }

  return segments
}
