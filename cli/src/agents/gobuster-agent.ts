/**
 * Gobuster Agent - Web Directory/DNS Enumeration
 *
 * Runs gobuster and returns structured, concise results.
 * Filters noise and highlights interesting findings.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeProcess } from '../utils/process-executor'
import { findWordlist } from '../utils/wordlist-finder'
import { parseToolOutput, createErrorResult, buildItemSummary } from '../services/agent-parser'

const GOBUSTER_SYSTEM_PROMPT = `You are a gobuster output analyzer. Parse the enumeration results and extract key findings.

Output format (JSON only):
{
  "directories": [
    { "path": "/admin", "status": 200, "size": 1234 },
    { "path": "/backup", "status": 301, "redirect": "/backup/" }
  ],
  "files": [
    { "path": "/config.php.bak", "status": 200, "size": 456 },
    { "path": "/.git/config", "status": 200, "size": 123 }
  ],
  "interesting": [
    { "path": "/admin", "reason": "Admin panel - potential login bypass" },
    { "path": "/.git", "reason": "Git repo exposed - source code leak" },
    { "path": "/backup", "reason": "Backup files may contain credentials" }
  ],
  "totalFound": 45,
  "totalRequests": 4612,
  "errors": 3,
  "recommendations": ["Check /admin for default creds", "Download .git with git-dumper"]
}

Prioritize findings by security relevance:
1. Sensitive files (.git, .env, config backups, .htaccess)
2. Admin/login panels
3. API endpoints
4. Backup directories
5. Interesting status codes (403 forbidden = exists but blocked)

Only output JSON, nothing else.`

const gobusterParams = z.object({
  url: z.string().describe('Target URL (e.g., http://10.10.10.1)'),
  mode: z.enum(['dir', 'dns', 'vhost']).optional().default('dir')
    .describe('Mode: dir (directories), dns (subdomains), vhost (virtual hosts)'),
  wordlist: z.string().optional()
    .describe('Wordlist path (default: /usr/share/wordlists/dirb/common.txt)'),
  extensions: z.string().optional()
    .describe('File extensions to check (e.g., "php,txt,html,bak")'),
  threads: z.number().optional().default(10)
    .describe('Number of concurrent threads'),
  statusCodes: z.string().optional().default('200,204,301,302,307,401,403')
    .describe('Status codes to match'),
  excludeLength: z.string().optional()
    .describe('Exclude responses of this length'),
})

type GobusterParams = z.infer<typeof gobusterParams>

export interface DirEntry {
  path: string
  status: number
  size?: number
  redirect?: string
}

export interface InterestingFind {
  path: string
  reason: string
}

export interface GobusterResult {
  directories: DirEntry[]
  files: DirEntry[]
  interesting: InterestingFind[]
  totalFound: number
  totalRequests: number
  errors: number
  recommendations: string[]
  rawOutput?: string
}

const EMPTY_RESULT: GobusterResult = {
  directories: [],
  files: [],
  interesting: [],
  totalFound: 0,
  totalRequests: 0,
  errors: 0,
  recommendations: [],
}

/**
 * Build gobuster command from parameters
 */
async function buildGobusterCommand(params: GobusterParams): Promise<{ args: string[]; error?: string }> {
  const args: string[] = [params.mode]

  // URL
  args.push('-u', params.url)

  // Wordlist
  const wordlist = params.wordlist || findWordlist('directory')
  if (!wordlist) {
    return { args: [], error: 'No wordlist found. Install seclists or dirb.' }
  }
  args.push('-w', wordlist)

  // Extensions
  if (params.extensions) {
    args.push('-x', params.extensions)
  }

  // Threads
  args.push('-t', String(params.threads))

  // Status codes
  args.push('-s', params.statusCodes)

  // Exclude length
  if (params.excludeLength) {
    args.push('--exclude-length', params.excludeLength)
  }

  // Don't show progress (cleaner output)
  args.push('-q')

  // Expanded output for better parsing
  args.push('-e')

  return { args }
}

export const gobusterAgent = defineAgent<typeof gobusterParams, GobusterResult>({
  name: 'gobuster',
  description: 'Web directory/file enumeration. Discovers hidden paths, files, and interesting endpoints. Returns prioritized findings.',
  systemPrompt: GOBUSTER_SYSTEM_PROMPT,
  parameters: gobusterParams,

  async execute(params: GobusterParams, context): Promise<AgentResult<GobusterResult>> {
    // Build command
    const { args, error } = await buildGobusterCommand(params)
    if (error) {
      return createErrorResult('gobuster', error, EMPTY_RESULT)
    }

    // Run gobuster
    const scanResult = await executeProcess('gobuster', args, {
      timeoutMs: 300000, // 5 minutes
      toolName: 'gobuster',
    })

    if (!scanResult.success && !scanResult.output) {
      return createErrorResult('gobuster', scanResult.error, EMPTY_RESULT)
    }

    // Parse with LLM
    return parseToolOutput<GobusterResult>({
      toolName: 'gobuster',
      systemPrompt: GOBUSTER_SYSTEM_PROMPT,
      rawOutput: scanResult.output,
      context,
      emptyResult: EMPTY_RESULT,
      promptPrefix: `Parse this gobuster output for ${params.url}:`,
      buildSummary: (parsed) => {
        const interestingSummary = buildItemSummary(
          parsed.interesting,
          (i) => (i as InterestingFind).path,
          'interesting'
        )

        return [
          `Found ${parsed.totalFound} paths`,
          interestingSummary,
        ].filter(Boolean).join('. ')
      },
    })
  },
})
