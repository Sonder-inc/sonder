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
  let key = 0

  // Tokenize the text to handle markdown inline styles
  // Order matters: check bold (**) before italic (*) to avoid conflicts
  const tokens: Array<{ type: 'text' | 'bold' | 'italic' | 'code'; content: string }> = []
  let i = 0

  while (i < text.length) {
    // Bold: **text**
    if (text.slice(i, i + 2) === '**') {
      const endIdx = text.indexOf('**', i + 2)
      if (endIdx !== -1) {
        tokens.push({ type: 'bold', content: text.slice(i + 2, endIdx) })
        i = endIdx + 2
        continue
      }
    }

    // Inline code: `text`
    if (text[i] === '`') {
      const endIdx = text.indexOf('`', i + 1)
      if (endIdx !== -1) {
        tokens.push({ type: 'code', content: text.slice(i + 1, endIdx) })
        i = endIdx + 1
        continue
      }
    }

    // Italic: *text* (single asterisk, not at word boundary issues)
    if (text[i] === '*' && text[i + 1] !== '*') {
      const endIdx = text.indexOf('*', i + 1)
      if (endIdx !== -1 && text[endIdx - 1] !== '*') {
        tokens.push({ type: 'italic', content: text.slice(i + 1, endIdx) })
        i = endIdx + 1
        continue
      }
    }

    // Regular text - collect until next potential marker
    let nextMarker = text.length
    const markers = ['**', '*', '`']
    for (const marker of markers) {
      const idx = text.indexOf(marker, i)
      if (idx !== -1 && idx < nextMarker) {
        nextMarker = idx
      }
    }

    if (nextMarker > i) {
      tokens.push({ type: 'text', content: text.slice(i, nextMarker) })
      i = nextMarker
    } else {
      // No markers found, take rest of string
      tokens.push({ type: 'text', content: text.slice(i) })
      break
    }
  }

  // Convert tokens to React nodes
  for (const token of tokens) {
    switch (token.type) {
      case 'bold':
        segments.push(
          <span key={key++} attributes={TextAttributes.BOLD} fg={theme.muted}>
            {token.content}
          </span>
        )
        break
      case 'italic':
        segments.push(
          <span key={key++} attributes={TextAttributes.ITALIC} fg={theme.muted}>
            {token.content}
          </span>
        )
        break
      case 'code':
        segments.push(
          <span key={key++} fg={theme.muted}>
            {token.content}
          </span>
        )
        break
      default:
        segments.push(<span key={key++}>{token.content}</span>)
    }
  }

  return segments
}
