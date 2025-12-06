/**
 * VGrep Agent - Semantic Vulnerability Search
 *
 * Like WarpGrep for code, but for cybersecurity:
 * - Semantic search over CVE databases, ExploitDB, SecLists
 * - Correlates service fingerprints with known vulnerabilities
 * - Prioritizes by exploitability and relevance
 *
 * Inspired by MorphLLM's WarpGrep architecture:
 * - Combines grep (exact) + semantic (conceptual) search
 * - Budget-aware: max parallel searches to avoid context rot
 * - Returns prioritized, actionable results
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'
import { executeProcess } from '../utils/process-executor'

const VGREP_SYSTEM_PROMPT = `You are VGrep, a semantic vulnerability search agent. You combine exact pattern matching with semantic understanding to find relevant exploits, CVEs, and attack vectors.

Your job:
1. Parse the query to understand WHAT the user is looking for (exploit type, service, version)
2. Analyze search results from multiple sources (searchsploit, grep over wordlists, CVE lookups)
3. Correlate and deduplicate findings
4. Prioritize by: exploitability > impact > ease of use
5. Return actionable results with clear next steps

Output format (JSON):
{
  "query_understanding": {
    "service": "apache",
    "version": "2.4.49",
    "vuln_type": "rce|lfi|sqli|auth_bypass|info_disclosure|any",
    "keywords": ["path traversal", "mod_cgi"]
  },
  "vulnerabilities": [
    {
      "id": "CVE-2021-41773",
      "title": "Apache 2.4.49 Path Traversal and RCE",
      "severity": "critical|high|medium|low",
      "exploitability": "trivial|easy|moderate|hard",
      "type": "rce",
      "affected_versions": "2.4.49, 2.4.50",
      "exploit_available": true,
      "metasploit": true,
      "references": ["exploit-db:50383", "msf:exploit/multi/http/apache_normalize_path_rce"]
    }
  ],
  "exploits": [
    {
      "source": "exploit-db|github|metasploit|packetstorm",
      "id": "50383",
      "title": "Apache 2.4.49 - Path Traversal RCE",
      "path": "linux/webapps/50383.py",
      "verified": true,
      "language": "python"
    }
  ],
  "wordlists": [
    {
      "name": "apache-paths.txt",
      "path": "/usr/share/seclists/Discovery/Web-Content/apache.txt",
      "relevance": "directory enumeration for apache",
      "entries": 1500
    }
  ],
  "attack_vectors": [
    {
      "technique": "Path Traversal to RCE",
      "steps": ["Confirm mod_cgi enabled", "Send crafted request", "Execute commands"],
      "tools": ["curl", "nuclei", "metasploit"],
      "difficulty": "easy"
    }
  ],
  "recommendations": [
    "Start with CVE-2021-41773 - trivial RCE if mod_cgi is enabled",
    "Use nuclei template for quick verification",
    "Metasploit module handles exploitation automatically"
  ],
  "confidence": 0.95,
  "search_stats": {
    "sources_queried": 3,
    "total_results": 15,
    "filtered_results": 5
  }
}

Prioritization rules:
1. RCE > Auth Bypass > LFI > SQLi > XSS > Info Disclosure
2. Verified exploits > Unverified
3. Metasploit modules > Standalone scripts
4. Recent CVEs > Old ones (unless classics like EternalBlue)
5. Easy exploitation > Complex chains

Only output JSON, nothing else.`

const vgrepParams = z.object({
  query: z.string().describe('Semantic search query (e.g., "apache 2.4 rce", "wordpress auth bypass", "ftp anonymous login exploit")'),
  services: z.array(z.object({
    name: z.string(),
    version: z.string().optional(),
    port: z.number().optional(),
    banner: z.string().optional(),
  })).optional().describe('Service fingerprints from nmap/banner grab'),
  vulnTypes: z.array(z.enum(['rce', 'lfi', 'sqli', 'xss', 'auth_bypass', 'info_disclosure', 'dos', 'privesc', 'any']))
    .optional().default(['any'])
    .describe('Types of vulnerabilities to search for'),
  sources: z.array(z.enum(['exploit-db', 'cve', 'seclists', 'nuclei', 'all']))
    .optional().default(['all'])
    .describe('Sources to search'),
  maxResults: z.number().optional().default(10)
    .describe('Maximum results per category'),
})

type VgrepParams = z.infer<typeof vgrepParams>

export interface VgrepVulnerability {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  exploitability: 'trivial' | 'easy' | 'moderate' | 'hard'
  type: string
  affected_versions?: string
  exploit_available: boolean
  metasploit: boolean
  references: string[]
}

export interface VgrepExploit {
  source: string
  id: string
  title: string
  path: string
  verified: boolean
  language?: string
}

export interface VgrepWordlist {
  name: string
  path: string
  relevance: string
  entries?: number
}

export interface VgrepAttackVector {
  technique: string
  steps: string[]
  tools: string[]
  difficulty: string
}

export interface VgrepResult {
  query_understanding: {
    service?: string
    version?: string
    vuln_type?: string
    keywords: string[]
  }
  vulnerabilities: VgrepVulnerability[]
  exploits: VgrepExploit[]
  wordlists: VgrepWordlist[]
  attack_vectors: VgrepAttackVector[]
  recommendations: string[]
  confidence: number
  search_stats: {
    sources_queried: number
    total_results: number
    filtered_results: number
  }
  rawOutput?: string
}

const EMPTY_RESULT: VgrepResult = {
  query_understanding: { keywords: [] },
  vulnerabilities: [],
  exploits: [],
  wordlists: [],
  attack_vectors: [],
  recommendations: [],
  confidence: 0,
  search_stats: { sources_queried: 0, total_results: 0, filtered_results: 0 },
}

/**
 * Run searchsploit and capture output
 */
async function runSearchsploit(query: string): Promise<string> {
  const result = await executeProcess('searchsploit', ['-w', '--exclude=dos', query], {
    timeoutMs: 15000,
    toolName: 'searchsploit',
  })
  return result.success ? result.output : ''
}

/**
 * Search SecLists for relevant wordlists
 */
async function searchSeclists(keywords: string[]): Promise<string> {
  const seclistsPath = '/usr/share/seclists'
  const results: string[] = []

  for (const keyword of keywords.slice(0, 3)) { // Limit parallel searches
    const result = await executeProcess('find', [
      seclistsPath,
      '-type', 'f',
      '-iname', `*${keyword}*`,
      '-o', '-ipath', `*${keyword}*`,
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

/**
 * Search nuclei templates
 */
async function searchNucleiTemplates(query: string): Promise<string> {
  const result = await executeProcess('nuclei', [
    '-tl', // Template list
    '-tags', query.toLowerCase().replace(/\s+/g, ','),
  ], {
    timeoutMs: 10000,
    toolName: 'nuclei-templates',
  })
  return result.success ? result.output : ''
}

export const vgrepAgent = defineAgent<typeof vgrepParams, VgrepResult>({
  name: 'vgrep',
  description: 'Semantic vulnerability search. Finds CVEs, exploits, wordlists, and attack vectors for services/software. Like WarpGrep but for pentesting.',
  systemPrompt: VGREP_SYSTEM_PROMPT,
  parameters: vgrepParams,

  async execute(params: VgrepParams, context): Promise<AgentResult<VgrepResult>> {
    // Build search queries from params
    const searchQueries: string[] = [params.query]

    // Add service-specific queries
    if (params.services?.length) {
      for (const svc of params.services) {
        if (svc.version) {
          searchQueries.push(`${svc.name} ${svc.version}`)
        } else {
          searchQueries.push(svc.name)
        }
      }
    }

    // Run parallel searches (budget: max 4 concurrent)
    const searches = await Promise.all([
      // SearchSploit for exploits
      runSearchsploit(searchQueries[0]),
      // SecLists for wordlists
      searchSeclists(searchQueries[0].split(/\s+/)),
      // Nuclei templates (if available)
      params.sources.includes('all') || params.sources.includes('nuclei')
        ? searchNucleiTemplates(searchQueries[0])
        : Promise.resolve(''),
    ])

    const [searchsploitOutput, seclistsOutput, nucleiOutput] = searches

    // Combine all outputs for LLM analysis
    const combinedOutput = [
      '=== SEARCHSPLOIT RESULTS ===',
      searchsploitOutput || 'No results',
      '',
      '=== SECLISTS MATCHES ===',
      seclistsOutput || 'No matches',
      '',
      '=== NUCLEI TEMPLATES ===',
      nucleiOutput || 'Not available',
    ].join('\n')

    // Build context for LLM
    let userPrompt = `Query: "${params.query}"`

    if (params.services?.length) {
      userPrompt += '\n\nTarget services:\n'
      for (const svc of params.services) {
        userPrompt += `- ${svc.name}${svc.version ? ` ${svc.version}` : ''}${svc.port ? ` (port ${svc.port})` : ''}\n`
        if (svc.banner) userPrompt += `  Banner: ${svc.banner}\n`
      }
    }

    if (params.vulnTypes && !params.vulnTypes.includes('any')) {
      userPrompt += `\nFilter by vulnerability types: ${params.vulnTypes.join(', ')}`
    }

    userPrompt += `\n\nSearch results:\n${combinedOutput}`

    // Run LLM analysis
    const result = await executeAgentLLM({
      name: 'vgrep',
      systemPrompt: VGREP_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'VGrep search failed',
        data: { ...EMPTY_RESULT, rawOutput: combinedOutput },
      }
    }

    try {
      const parsed = JSON.parse(result.text) as VgrepResult

      // Build summary
      const vulnCount = parsed.vulnerabilities.length
      const exploitCount = parsed.exploits.length
      const criticalCount = parsed.vulnerabilities.filter(v => v.severity === 'critical').length

      const summaryParts = [
        `Found ${vulnCount} vulnerabilities`,
        criticalCount > 0 ? `(${criticalCount} critical)` : '',
        exploitCount > 0 ? `${exploitCount} exploits` : '',
        parsed.recommendations[0] ? `Top: ${parsed.recommendations[0].slice(0, 50)}...` : '',
      ].filter(Boolean)

      return {
        success: true,
        summary: summaryParts.join(', '),
        data: parsed,
      }
    } catch {
      return {
        success: true,
        summary: 'VGrep complete (parse failed)',
        data: { ...EMPTY_RESULT, rawOutput: combinedOutput },
      }
    }
  },
})
