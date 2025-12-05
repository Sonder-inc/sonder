/**
 * Text editing utilities for input manipulation
 */

export const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f]/
export const TAB_WIDTH = 4

export function preventKeyDefault(key: { preventDefault?: () => void } | null | undefined): void {
  key?.preventDefault?.()
}

export function insertText(
  text: string,
  cursor: number,
  insertion: string
): { text: string; cursor: number } {
  const newText = text.slice(0, cursor) + insertion + text.slice(cursor)
  return {
    text: newText,
    cursor: cursor + insertion.length,
  }
}

export function deleteRange(
  text: string,
  start: number,
  end: number
): { text: string; cursor: number } {
  const newText = text.slice(0, start) + text.slice(end)
  return {
    text: newText,
    cursor: start,
  }
}

export function expandTabs(text: string, tabWidth: number = TAB_WIDTH): string {
  return text.replace(/\t/g, ' '.repeat(tabWidth))
}

export function calculateRenderPosition(
  text: string,
  cursorPosition: number,
  tabWidth: number = TAB_WIDTH
): number {
  let renderPosition = 0
  for (let i = 0; i < cursorPosition && i < text.length; i++) {
    renderPosition += text[i] === '\t' ? tabWidth : 1
  }
  return renderPosition
}
