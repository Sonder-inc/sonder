/**
 * SearchSploit Agent - Exploit Database Search
 *
 * Searches exploit-db for known vulnerabilities and exploits.
 * No network required - searches local database.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeProcess } from '../utils/process-executor'
import { parseToolOutput, createErrorResult } from '../services/agent-parser'

const SEARCHSPLOIT_SYSTEM_PROMPT = `You are a searchsploit output analyzer. Parse the exploit search results and prioritize by usefulness.

Output format (JSON only):
{
  "exploits": [
    {
      "title": "Apache 2.4.49 - Path Traversal RCE",
      "path": "linux/webapps/50383.py",
      "type": "webapps",
      "platform": "linux",
      "verified": true
    }
  ],
  "metasploitModules": [
    {
      "title": "Apache mod_cgi Bash Environment Variable Code Injection",
      "path": "exploit/multi/http/apache_mod_cgi_bash_env_exec",
      "type": "exploit"
    }
  ],
  "proofOfConcepts": [
    {
      "title": "vsftpd 2.3.4 Backdoor Command Execution",
      "path": "unix/remote/17491.rb",
      "language": "ruby"
    }
  ],
  "totalResults": 15,
  "mostRelevant": "CVE-2021-41773 - Apache Path Traversal (50383.py) - direct RCE",
  "recommendations": [
    "Try 50383.py first - verified working RCE",
    "Metasploit module available for easier exploitation",
    "Check if target version matches exactly"
  ]
}

Prioritize results:
1. Verified exploits
2. Metasploit modules (easiest to use)
3. Remote code execution
4. Authentication bypass
5. Information disclosure

Only output JSON, nothing else.`

const searchsploitParams = z.object({
  query: z.string().describe('Search query (service name, CVE, software version, e.g., "vsftpd 2.3.4" or "Apache 2.4.49")'),
  exact: z.boolean().optional().default(false)
    .describe('Exact match only'),
  excludeDoS: z.boolean().optional().default(true)
    .describe('Exclude denial of service exploits'),
})

type SearchsploitParams = z.infer<typeof searchsploitParams>

export interface Exploit {
  title: string
  path: string
  type: string
  platform: string
  verified?: boolean
  cve?: string
}

export interface MetasploitModule {
  title: string
  path: string
  type: string
}

export interface ProofOfConcept {
  title: string
  path: string
  language?: string
}

export interface SearchsploitResult {
  exploits: Exploit[]
  metasploitModules: MetasploitModule[]
  proofOfConcepts: ProofOfConcept[]
  totalResults: number
  mostRelevant?: string
  recommendations: string[]
  rawOutput?: string
}

const EMPTY_RESULT: SearchsploitResult = {
  exploits: [],
  metasploitModules: [],
  proofOfConcepts: [],
  totalResults: 0,
  recommendations: [],
}

/**
 * Build searchsploit command from parameters
 */
function buildSearchsploitCommand(params: SearchsploitParams): string[] {
  const args: string[] = []

  // Exact match
  if (params.exact) {
    args.push('-e')
  }

  // Exclude DoS
  if (params.excludeDoS) {
    args.push('--exclude=dos')
  }

  // Include Metasploit modules
  args.push('-m')

  // Query
  args.push(...params.query.split(' '))

  return args
}

export const searchsploitAgent = defineAgent<typeof searchsploitParams, SearchsploitResult>({
  name: 'searchsploit',
  description: 'Search exploit-db for known vulnerabilities. Finds exploits, Metasploit modules, and PoCs for services/versions.',
  systemPrompt: SEARCHSPLOIT_SYSTEM_PROMPT,
  parameters: searchsploitParams,

  async execute(params: SearchsploitParams, context): Promise<AgentResult<SearchsploitResult>> {
    const args = buildSearchsploitCommand(params)

    // Run searchsploit
    const searchResult = await executeProcess('searchsploit', args, {
      timeoutMs: 30000, // 30 seconds (local DB search)
      toolName: 'searchsploit',
    })

    if (!searchResult.success && !searchResult.output) {
      return createErrorResult('searchsploit', searchResult.error, EMPTY_RESULT)
    }

    // Check for no results
    if (searchResult.output.includes('No Results')) {
      return {
        success: true,
        summary: `No exploits found for "${params.query}"`,
        data: {
          ...EMPTY_RESULT,
          recommendations: ['Try broader search terms', 'Check version number format'],
        },
      }
    }

    // Parse with LLM
    return parseToolOutput<SearchsploitResult>({
      toolName: 'searchsploit',
      systemPrompt: SEARCHSPLOIT_SYSTEM_PROMPT,
      rawOutput: searchResult.output,
      context,
      emptyResult: EMPTY_RESULT,
      promptPrefix: `Parse this searchsploit output for query "${params.query}":`,
      buildSummary: (parsed) => {
        const exploitCount = parsed.exploits.length
        const msfCount = parsed.metasploitModules.length

        return [
          `Found ${parsed.totalResults} results for "${params.query}"`,
          exploitCount > 0 ? `${exploitCount} exploits` : '',
          msfCount > 0 ? `${msfCount} Metasploit modules` : '',
          parsed.mostRelevant ? `Best: ${parsed.mostRelevant}` : '',
        ].filter(Boolean).join('. ')
      },
    })
  },
})
