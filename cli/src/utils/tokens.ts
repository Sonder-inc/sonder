/**
 * Rough token estimation (4 chars ≈ 1 token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return tokens.toString()
}

/**
 * Calculate token usage from messages array
 */
export function calculateMessageTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((acc, msg) => acc + estimateTokens(msg.content), 0)
}
