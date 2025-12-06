import { COMMANDS, CONTEXT_ITEMS, type Command, type ContextItem } from '../constants/app-constants'

/**
 * Calculate fuzzy match score between query and target
 * Higher score = better match
 * Returns 0 if no match
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()

  // Exact prefix match gets highest score
  if (t.startsWith(q)) {
    return 1000 + (q.length / t.length) * 100
  }

  // Check if all query chars appear in order (fuzzy match)
  let qIdx = 0
  let score = 0
  let consecutiveBonus = 0
  let lastMatchIdx = -2

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      // Base score for matching
      score += 10

      // Bonus for consecutive matches
      if (tIdx === lastMatchIdx + 1) {
        consecutiveBonus += 5
        score += consecutiveBonus
      } else {
        consecutiveBonus = 0
      }

      // Bonus for matching at start or after separator
      if (tIdx === 0 || t[tIdx - 1] === '/' || t[tIdx - 1] === '-' || t[tIdx - 1] === '*') {
        score += 15
      }

      lastMatchIdx = tIdx
      qIdx++
    }
  }

  // All query chars must be found
  if (qIdx < q.length) {
    return 0
  }

  // Penalize longer targets slightly
  score -= (t.length - q.length) * 0.5

  return score
}

/**
 * Fuzzy search items, returning matches sorted by score
 */
function fuzzySearch<T>(items: readonly T[], query: string, getKey: (item: T) => string): T[] {
  if (!query) return [...items]

  const scored = items
    .map((item) => ({ item, score: fuzzyScore(query, getKey(item)) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.map(({ item }) => item)
}

/**
 * Fuzzy search with multiple fields, taking best score
 */
function fuzzySearchMulti<T>(
  items: readonly T[],
  query: string,
  getFields: (item: T) => string[]
): T[] {
  if (!query) return [...items]

  const scored = items
    .map((item) => {
      const fields = getFields(item)
      const bestScore = Math.max(...fields.map((f) => fuzzyScore(query, f)))
      return { item, score: bestScore }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.map(({ item }) => item)
}

// Convenience search functions with fuzzy matching on name + description
export const searchCommands = (query: string): Command[] =>
  fuzzySearchMulti(COMMANDS, query, (cmd) => [cmd.name, cmd.description, ...cmd.aliases])

export const searchContext = (query: string): ContextItem[] =>
  fuzzySearchMulti(CONTEXT_ITEMS, query, (item) => [item.name, item.label])
