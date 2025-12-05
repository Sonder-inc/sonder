/**
 * Text navigation utilities for cursor movement
 */

export function findLineStart(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  while (pos > 0 && text[pos - 1] !== '\n') {
    pos--
  }
  return pos
}

export function findLineEnd(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  while (pos < text.length && text[pos] !== '\n') {
    pos++
  }
  return pos
}

export function findPreviousWordBoundary(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  // Skip trailing whitespace
  while (pos > 0 && /\s/.test(text[pos - 1]!)) {
    pos--
  }
  // Skip word characters
  while (pos > 0 && !/\s/.test(text[pos - 1]!)) {
    pos--
  }
  return pos
}

export function findNextWordBoundary(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  // Skip current word
  while (pos < text.length && !/\s/.test(text[pos]!)) {
    pos++
  }
  // Skip whitespace
  while (pos < text.length && /\s/.test(text[pos]!)) {
    pos++
  }
  return pos
}
