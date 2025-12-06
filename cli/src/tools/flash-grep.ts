/**
 * FlashGrep - WarpGrep-inspired intelligent search
 *
 * Like MorphLLM's WarpGrep but for pentesting:
 * - Parallel search execution (up to 8 concurrent)
 * - Semantic + exact pattern matching
 * - Context-aware result ranking
 * - Budget-controlled to prevent context rot
 *
 * Modes:
 * - exact: ripgrep pattern matching (fast, precise)
 * - semantic: LLM-enhanced search understanding
 * - auto: chooses based on query complexity
 */

import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { spawn } from 'child_process'
import { executeAgentLLM } from '../services/agent-executor'

const flashGrepParams = z.object({
  query: z.string().describe('Search query - can be exact pattern or natural language'),
  paths: z.array(z.string()).optional().default(['.'])
    .describe('Directories or files to search (parallel search across all)'),
  mode: z.enum(['exact', 'semantic', 'auto']).optional().default('auto')
    .describe('Search mode: exact (ripgrep), semantic (LLM-ranked), auto (smart selection)'),
  filePatterns: z.array(z.string()).optional()
    .describe('Glob patterns for file types (e.g., ["*.ts", "*.py"])'),
  caseSensitive: z.boolean().optional().default(false),
  maxResults: z.number().optional().default(50)
    .describe('Max results per path (budget control)'),
  maxParallel: z.number().optional().default(8)
    .describe('Max parallel searches (like WarpGrep\'s 8-call limit)'),
  context: z.number().optional().default(2)
    .describe('Lines of context around matches'),
  rankBy: z.enum(['relevance', 'recency', 'frequency']).optional().default('relevance')
    .describe('How to rank results'),
})

type FlashGrepParams = z.infer<typeof flashGrepParams>

interface GrepMatch {
  file: string
  line: number
  content: string
  context?: string[]
  score?: number
}

interface FlashGrepResult {
  matches: GrepMatch[]
  totalMatches: number
  searchedPaths: string[]
  mode: string
  truncated: boolean
  queryUnderstanding?: {
    intent: string
    patterns: string[]
    suggestions: string[]
  }
}

const SEMANTIC_RANKING_PROMPT = `You are a search result ranker for a pentesting tool. Given search results and a query, rank them by relevance.

Output format (JSON):
{
  "queryUnderstanding": {
    "intent": "what the user is looking for",
    "patterns": ["regex patterns that might help"],
    "suggestions": ["other searches to try"]
  },
  "rankedResults": [
    {
      "file": "path/to/file",
      "line": 42,
      "content": "matched line",
      "score": 0.95,
      "reason": "why this is relevant"
    }
  ],
  "summary": "brief summary of findings"
}

Prioritize:
1. Exact matches to query terms
2. Security-relevant code (auth, crypto, input handling)
3. Configuration files with sensitive data
4. Entry points and main functions
5. Recent/actively used code

Only output JSON.`

/**
 * Run ripgrep search on a single path
 */
async function searchPath(
  pattern: string,
  path: string,
  options: {
    filePatterns?: string[]
    caseSensitive: boolean
    maxResults: number
    context: number
  }
): Promise<GrepMatch[]> {
  return new Promise((resolve) => {
    const args = [
      '--color=never',
      '--line-number',
      '--no-heading',
      `--max-count=${options.maxResults}`,
      `-C${options.context}`,
      '--json', // JSON output for structured parsing
    ]

    if (!options.caseSensitive) args.push('--ignore-case')
    if (options.filePatterns?.length) {
      for (const fp of options.filePatterns) {
        args.push('--glob', fp)
      }
    }

    args.push(pattern, path)

    const rg = spawn('rg', args, {
      cwd: process.cwd(),
      timeout: 10000, // 10s per path
    })

    let output = ''

    rg.stdout.on('data', (data) => {
      output += data.toString()
    })

    rg.on('error', () => {
      // ripgrep not found, fall back to basic grep
      resolve(fallbackGrep(pattern, path, options))
    })

    rg.on('close', () => {
      const matches: GrepMatch[] = []

      // Parse JSON lines output
      const lines = output.trim().split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'match') {
            matches.push({
              file: parsed.data.path.text,
              line: parsed.data.line_number,
              content: parsed.data.lines.text.trim(),
              context: parsed.data.submatches?.map((s: { match: { text: string } }) => s.match.text),
            })
          }
        } catch {
          // Skip malformed lines
        }
      }

      resolve(matches)
    })
  })
}

/**
 * Fallback to basic grep if ripgrep not available
 */
async function fallbackGrep(
  pattern: string,
  path: string,
  options: { caseSensitive: boolean; maxResults: number }
): Promise<GrepMatch[]> {
  return new Promise((resolve) => {
    const args = [
      '-rn',
      options.caseSensitive ? '' : '-i',
      `-m${options.maxResults}`,
      pattern,
      path,
    ].filter(Boolean)

    const proc = spawn('grep', args, {
      cwd: process.cwd(),
      timeout: 10000,
    })

    let output = ''

    proc.stdout.on('data', (data) => {
      output += data.toString()
    })

    proc.on('close', () => {
      const matches: GrepMatch[] = []
      const lines = output.trim().split('\n').filter(Boolean)

      for (const line of lines) {
        const match = line.match(/^(.+?):(\d+):(.*)$/)
        if (match) {
          matches.push({
            file: match[1],
            line: parseInt(match[2], 10),
            content: match[3].trim(),
          })
        }
      }

      resolve(matches)
    })
  })
}

/**
 * Determine if query needs semantic understanding
 */
function needsSemanticMode(query: string): boolean {
  // Natural language indicators
  const nlIndicators = [
    /\b(find|show|where|how|what|which|list|get)\b/i,
    /\b(handles?|processes?|validates?|checks?)\b/i,
    /\b(authentication|authorization|login|password|credential)/i,
    /\b(vulnerab|exploit|inject|bypass|overflow)/i,
    /\?$/, // Questions
  ]

  return nlIndicators.some(re => re.test(query))
}

/**
 * Extract regex patterns from natural language query
 */
function extractPatterns(query: string): string[] {
  const patterns: string[] = []

  // Direct technical terms become patterns
  const technicalTerms = query.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || []
  const stopWords = new Set(['find', 'show', 'where', 'how', 'what', 'which', 'the', 'a', 'an', 'is', 'are', 'in', 'for', 'to', 'of', 'and', 'or'])

  for (const term of technicalTerms) {
    if (!stopWords.has(term.toLowerCase()) && term.length > 2) {
      patterns.push(term)
    }
  }

  // Security-specific pattern expansions
  const expansions: Record<string, string[]> = {
    'auth': ['auth', 'login', 'session', 'token', 'jwt', 'oauth'],
    'password': ['password', 'passwd', 'pwd', 'secret', 'credential'],
    'sql': ['sql', 'query', 'execute', 'SELECT', 'INSERT', 'UPDATE'],
    'injection': ['inject', 'eval', 'exec', 'system', 'shell'],
    'xss': ['innerHTML', 'document.write', 'eval', 'dangerouslySetInnerHTML'],
    'file': ['readFile', 'writeFile', 'open', 'fopen', 'path.join'],
  }

  for (const [key, vals] of Object.entries(expansions)) {
    if (query.toLowerCase().includes(key)) {
      patterns.push(...vals)
    }
  }

  return [...new Set(patterns)]
}

export const flashGrep = defineTool({
  name: 'flash_grep',
  description: 'WarpGrep-style intelligent search. Parallel execution, semantic understanding, context-aware ranking. Use for finding code, configs, vulnerabilities.',
  parameters: flashGrepParams,

  execute: async (params: FlashGrepParams): Promise<ToolResult> => {
    const {
      query,
      paths,
      mode,
      filePatterns,
      caseSensitive,
      maxResults,
      maxParallel,
      context,
      rankBy,
    } = params

    // Determine actual mode
    const actualMode = mode === 'auto'
      ? (needsSemanticMode(query) ? 'semantic' : 'exact')
      : mode

    // Extract search patterns
    const patterns = actualMode === 'semantic'
      ? extractPatterns(query)
      : [query]

    if (patterns.length === 0) {
      patterns.push(query) // Fallback to raw query
    }

    // Run parallel searches with budget control
    const allMatches: GrepMatch[] = []
    const searchedPaths: string[] = []

    // Build search tasks: (pattern, path) combinations
    const searchTasks: Array<{ pattern: string; path: string }> = []
    for (const pattern of patterns.slice(0, 5)) { // Max 5 patterns
      for (const path of paths) {
        searchTasks.push({ pattern, path })
      }
    }

    // Execute in batches respecting maxParallel
    for (let i = 0; i < searchTasks.length; i += maxParallel) {
      const batch = searchTasks.slice(i, i + maxParallel)

      const batchResults = await Promise.all(
        batch.map(({ pattern, path }) =>
          searchPath(pattern, path, {
            filePatterns,
            caseSensitive,
            maxResults: Math.ceil(maxResults / patterns.length),
            context,
          }).then(matches => {
            if (!searchedPaths.includes(path)) searchedPaths.push(path)
            return matches
          })
        )
      )

      for (const matches of batchResults) {
        allMatches.push(...matches)
      }

      // Early exit if we have enough results
      if (allMatches.length >= maxResults * 2) break
    }

    // Deduplicate by file:line
    const seen = new Set<string>()
    const dedupedMatches = allMatches.filter(m => {
      const key = `${m.file}:${m.line}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Rank results
    let rankedMatches = dedupedMatches
    let queryUnderstanding: FlashGrepResult['queryUnderstanding']

    if (actualMode === 'semantic' && dedupedMatches.length > 0) {
      // Use LLM to rank and understand
      try {
        const llmResult = await executeAgentLLM({
          name: 'flash_grep_ranker',
          systemPrompt: SEMANTIC_RANKING_PROMPT,
          userPrompt: `Query: "${query}"\n\nResults to rank:\n${JSON.stringify(dedupedMatches.slice(0, 30), null, 2)}`,
          context: { conversationContext: '', userIntent: query },
        })

        if (llmResult.success) {
          const parsed = JSON.parse(llmResult.text)
          queryUnderstanding = parsed.queryUnderstanding

          // Apply LLM ranking scores
          if (parsed.rankedResults) {
            const scoreMap = new Map<string, number>(
              parsed.rankedResults.map((r: { file: string; line: number; score: number }) =>
                [`${r.file}:${r.line}`, r.score] as [string, number]
              )
            )
            rankedMatches = dedupedMatches
              .map(m => ({ ...m, score: scoreMap.get(`${m.file}:${m.line}`) ?? 0.5 }))
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          }
        }
      } catch {
        // Fall back to basic ranking
      }
    }

    // Apply frequency/recency ranking if not semantic
    if (rankBy === 'frequency') {
      const fileFreq = new Map<string, number>()
      for (const m of rankedMatches) {
        fileFreq.set(m.file, (fileFreq.get(m.file) ?? 0) + 1)
      }
      rankedMatches.sort((a, b) => (fileFreq.get(b.file) ?? 0) - (fileFreq.get(a.file) ?? 0))
    }

    // Truncate to maxResults
    const truncated = rankedMatches.length > maxResults
    const finalMatches = rankedMatches.slice(0, maxResults)

    // Format output
    const result: FlashGrepResult = {
      matches: finalMatches,
      totalMatches: dedupedMatches.length,
      searchedPaths,
      mode: actualMode,
      truncated,
      queryUnderstanding,
    }

    // Build human-readable output
    let fullResult = ''

    if (queryUnderstanding) {
      fullResult += `Query: "${query}"\n`
      fullResult += `Intent: ${queryUnderstanding.intent}\n`
      if (queryUnderstanding.suggestions.length) {
        fullResult += `Suggestions: ${queryUnderstanding.suggestions.join(', ')}\n`
      }
      fullResult += '\n'
    }

    fullResult += `Mode: ${actualMode} | Searched: ${searchedPaths.length} paths | Found: ${dedupedMatches.length} matches\n\n`

    for (const match of finalMatches) {
      const scoreStr = match.score !== undefined ? ` [${(match.score * 100).toFixed(0)}%]` : ''
      fullResult += `${match.file}:${match.line}${scoreStr}\n`
      fullResult += `  ${match.content}\n`
      if (match.context?.length) {
        fullResult += `  context: ${match.context.join(' | ')}\n`
      }
      fullResult += '\n'
    }

    if (truncated) {
      fullResult += `\n... and ${dedupedMatches.length - maxResults} more matches (truncated)\n`
    }

    return {
      success: true,
      summary: `${finalMatches.length}${truncated ? '+' : ''} matches (${actualMode})`,
      fullResult,
      displayInput: query,
    }
  },
})
