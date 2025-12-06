/**
 * Run Vulnerability Search Tool
 *
 * Searches for vulnerabilities using searchsploit, seclists, and nuclei templates.
 * Handles parallelization internally for efficiency.
 */

import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { executeProcess } from '../utils/process-executor'

const runVulnSearchParams = z.object({
  query: z.string().describe('Search query (e.g., "apache 2.4.49", "wordpress rce")'),
  keywords: z.array(z.string()).optional().describe('Additional keywords for seclists search'),
  sources: z.array(z.enum(['searchsploit', 'seclists', 'nuclei', 'all']))
    .optional().default(['all'])
    .describe('Sources to search'),
})

async function runSearchsploit(query: string): Promise<string> {
  const result = await executeProcess('searchsploit', ['-w', '--exclude=dos', query], {
    timeoutMs: 15000,
    toolName: 'searchsploit',
  })
  return result.success ? result.output : ''
}

async function searchSeclists(keywords: string[]): Promise<string> {
  const seclistsPath = '/usr/share/seclists'
  const results: string[] = []

  for (const keyword of keywords.slice(0, 3)) {
    const result = await executeProcess('find', [
      seclistsPath,
      '-type', 'f',
      '-iname', `*${keyword}*`,
    ], {
      timeoutMs: 5000,
      toolName: 'find-seclists',
    })
    if (result.success && result.output) {
      results.push(result.output)
    }
  }

  return results.join('\n')
}

async function searchNucleiTemplates(query: string): Promise<string> {
  const result = await executeProcess('nuclei', [
    '-tl',
    '-tags', query.toLowerCase().replace(/\s+/g, ','),
  ], {
    timeoutMs: 10000,
    toolName: 'nuclei-templates',
  })
  return result.success ? result.output : ''
}

export const runVulnSearch = defineTool({
  name: 'run_vuln_search',
  description: 'Search for vulnerabilities using searchsploit, seclists, and nuclei templates.',
  parameters: runVulnSearchParams,

  async execute({ query, keywords, sources }): Promise<ToolResult> {
    const searchAll = sources.includes('all')
    const effectiveKeywords = keywords || query.split(/\s+/)

    const searches = await Promise.all([
      searchAll || sources.includes('searchsploit')
        ? runSearchsploit(query)
        : Promise.resolve(''),
      searchAll || sources.includes('seclists')
        ? searchSeclists(effectiveKeywords)
        : Promise.resolve(''),
      searchAll || sources.includes('nuclei')
        ? searchNucleiTemplates(query)
        : Promise.resolve(''),
    ])

    const [searchsploitOutput, seclistsOutput, nucleiOutput] = searches

    const outputParts = [
      '=== SEARCHSPLOIT RESULTS ===',
      searchsploitOutput || 'No results',
      '',
      '=== SECLISTS MATCHES ===',
      seclistsOutput || 'No matches',
      '',
      '=== NUCLEI TEMPLATES ===',
      nucleiOutput || 'Not available',
    ]

    const hasResults = searchsploitOutput || seclistsOutput || nucleiOutput

    return {
      success: !!hasResults,
      summary: hasResults ? `Found results for "${query}"` : `No results for "${query}"`,
      fullResult: outputParts.join('\n'),
      displayName: 'VulnSearch',
      displayInput: query,
      displayColor: hasResults ? 'success' : 'default',
    }
  },
})

/**
 * Run Exploit Match Tool
 *
 * Extracts search terms from fingerprints and searches for exploits.
 */
const runExploitMatchParams = z.object({
  fingerprints: z.array(z.object({
    banner: z.string(),
    port: z.number().optional(),
  })).describe('Service fingerprints to match'),
})

function extractSearchTerms(fingerprints: Array<{ banner: string }>): string[] {
  const terms: string[] = []

  for (const fp of fingerprints) {
    const cleaned = fp.banner
      .toLowerCase()
      .replace(/[()]/g, ' ')
      .replace(/[/_-]/g, ' ')
      .trim()

    const versionMatch = cleaned.match(/(\w+)\s*([\d.]+)/)
    if (versionMatch) {
      terms.push(`${versionMatch[1]} ${versionMatch[2]}`)
    } else {
      const firstWord = cleaned.split(/\s+/)[0]
      if (firstWord && firstWord.length > 2) {
        terms.push(firstWord)
      }
    }
  }

  return [...new Set(terms)]
}

export const runExploitMatch = defineTool({
  name: 'run_exploit_match',
  description: 'Match service fingerprints against exploit databases.',
  parameters: runExploitMatchParams,

  async execute({ fingerprints }): Promise<ToolResult> {
    const searchTerms = extractSearchTerms(fingerprints)
    const results: string[] = []

    for (const term of searchTerms.slice(0, 5)) {
      const result = await executeProcess('searchsploit', [
        '-w',
        '--exclude=dos',
        term,
      ], {
        timeoutMs: 10000,
        toolName: 'searchsploit',
      })

      if (result.success && result.output && !result.output.includes('No Results')) {
        results.push(`=== ${term} ===\n${result.output}`)
      }
    }

    const output = results.join('\n\n') || 'No exploits found'
    const fingerprintList = fingerprints.map(f => f.banner).join(', ')

    return {
      success: results.length > 0,
      summary: results.length > 0
        ? `Found exploits for ${results.length} fingerprints`
        : 'No exploits found',
      fullResult: `Fingerprints analyzed: ${fingerprintList}\n\n${output}`,
      displayName: 'ExploitMatch',
      displayInput: `${fingerprints.length} fingerprints`,
      displayColor: results.length > 0 ? 'success' : 'default',
    }
  },
})
