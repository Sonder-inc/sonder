import { TextAttributes } from '@opentui/core'
import type { CursorRendererProps } from './types'

/**
 * Renders text with cursor and slash command highlighting
 */
export function CursorRenderer({
  displayValueForRendering,
  renderCursorPosition,
  isPlaceholder,
  cursorVisible,
  showCursor,
  slashCommandEnd,
  theme,
}: CursorRendererProps) {
  const highlightBg = '#7dd3fc'

  if (!showCursor) {
    // No cursor - just render text with optional slash command highlighting
    if (slashCommandEnd > 0) {
      return (
        <>
          <span fg={theme.slashCommandFg}>{displayValueForRendering.slice(0, slashCommandEnd)}</span>
          {displayValueForRendering.slice(slashCommandEnd)}
        </>
      )
    }
    return <>{displayValueForRendering}</>
  }

  // Calculate cursor segments
  const beforeCursor = displayValueForRendering.slice(0, renderCursorPosition)
  const afterCursor = displayValueForRendering.slice(renderCursorPosition)
  const activeChar = afterCursor.charAt(0) || ' '
  const shouldHighlight =
    !isPlaceholder &&
    renderCursorPosition < displayValueForRendering.length &&
    displayValueForRendering[renderCursorPosition] !== '\n' &&
    displayValueForRendering[renderCursorPosition] !== '\t'

  // Render before cursor with slash command highlighting
  const renderBeforeCursor = () => {
    if (slashCommandEnd > 0 && renderCursorPosition > 0) {
      return (
        <>
          <span fg={theme.slashCommandFg}>
            {beforeCursor.slice(0, Math.min(slashCommandEnd, renderCursorPosition))}
          </span>
          {renderCursorPosition > slashCommandEnd && beforeCursor.slice(slashCommandEnd)}
        </>
      )
    }
    return <>{beforeCursor}</>
  }

  // Render the cursor character
  const renderCursor = () => {
    const char = activeChar === ' ' ? '\u00a0' : activeChar

    if (!cursorVisible) {
      return <span fg={theme.muted}>{char}</span>
    }

    if (shouldHighlight) {
      return (
        <span bg={highlightBg} fg={theme.background} attributes={TextAttributes.BOLD}>
          {char}
        </span>
      )
    }

    return (
      <span bg={theme.foreground} fg={theme.background}>
        {char}
      </span>
    )
  }

  // Render after cursor with slash command highlighting
  const renderAfterCursor = () => {
    const textAfter = shouldHighlight
      ? afterCursor.length > 0 ? afterCursor.slice(1) : ''
      : afterCursor

    if (slashCommandEnd > renderCursorPosition && textAfter.length > 0) {
      const cmdRemaining = slashCommandEnd - renderCursorPosition - (shouldHighlight ? 1 : 0)
      if (cmdRemaining > 0) {
        return (
          <>
            <span fg={theme.slashCommandFg}>{textAfter.slice(0, cmdRemaining)}</span>
            {textAfter.slice(cmdRemaining)}
          </>
        )
      }
    }
    return <>{textAfter}</>
  }

  return (
    <>
      {renderBeforeCursor()}
      {renderCursor()}
      {renderAfterCursor()}
    </>
  )
}
