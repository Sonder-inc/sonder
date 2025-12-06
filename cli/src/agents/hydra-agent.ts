/**
 * Hydra Agent - Credential Testing
 *
 * Runs hydra for password brute forcing with safety limits.
 * Educational use only - for HTB/THM machines.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeProcess } from '../utils/process-executor'
import { findWordlist } from '../utils/wordlist-finder'
import { parseToolOutput, createErrorResult } from '../services/agent-parser'

const HYDRA_SYSTEM_PROMPT = `You are a hydra output analyzer. Parse the password brute force results.

Output format (JSON only):
{
  "foundCredentials": [
    {
      "username": "admin",
      "password": "password123",
      "service": "ssh",
      "host": "10.10.10.1",
      "port": 22
    }
  ],
  "attemptedCombinations": 450,
  "successRate": "1/450",
  "duration": "2m 34s",
  "status": "success",
  "errors": [],
  "recommendations": [
    "Try found creds on other services",
    "Check for password reuse",
    "Try sudo with these creds"
  ]
}

Notes:
- Report exact credentials found
- Note any connection errors
- Suggest next steps based on findings

Only output JSON, nothing else.`

const hydraParams = z.object({
  target: z.string().describe('Target IP or hostname'),
  service: z.enum(['ssh', 'ftp', 'http-get', 'http-post', 'http-post-form', 'smb', 'rdp', 'mysql', 'postgres', 'telnet', 'vnc'])
    .describe('Service to attack'),
  port: z.number().optional().describe('Target port (uses default if not specified)'),
  username: z.string().optional().describe('Single username to try'),
  userList: z.string().optional().describe('Path to username wordlist'),
  password: z.string().optional().describe('Single password to try'),
  passList: z.string().optional().describe('Path to password wordlist'),
  threads: z.number().optional().default(4).describe('Number of parallel connections'),
  httpPath: z.string().optional().describe('HTTP path for web forms (e.g., /login.php)'),
  httpForm: z.string().optional().describe('HTTP form parameters (e.g., "user=^USER^&pass=^PASS^:F=Login failed")'),
})

type HydraParams = z.infer<typeof hydraParams>

export interface FoundCredential {
  username: string
  password: string
  service: string
  host: string
  port: number
}

export interface HydraResult {
  foundCredentials: FoundCredential[]
  attemptedCombinations: number
  successRate: string
  duration: string
  status: 'success' | 'no_creds' | 'error' | 'timeout'
  errors: string[]
  recommendations: string[]
  rawOutput?: string
}

const EMPTY_RESULT: HydraResult = {
  foundCredentials: [],
  attemptedCombinations: 0,
  successRate: '0/0',
  duration: '0s',
  status: 'error',
  errors: [],
  recommendations: [],
}

// Default ports for services
const DEFAULT_PORTS: Record<string, number> = {
  ssh: 22,
  ftp: 21,
  'http-get': 80,
  'http-post': 80,
  'http-post-form': 80,
  smb: 445,
  rdp: 3389,
  mysql: 3306,
  postgres: 5432,
  telnet: 23,
  vnc: 5900,
}

/**
 * Build hydra command from parameters
 */
function buildHydraCommand(params: HydraParams): { args: string[]; error?: string } {
  const args: string[] = []

  // Username(s)
  if (params.username) {
    args.push('-l', params.username)
  } else if (params.userList) {
    args.push('-L', params.userList)
  } else {
    const userList = findWordlist('usernames')
    if (!userList) {
      return { args: [], error: 'No username provided and no wordlist found' }
    }
    args.push('-L', userList)
  }

  // Password(s)
  if (params.password) {
    args.push('-p', params.password)
  } else if (params.passList) {
    args.push('-P', params.passList)
  } else {
    const passList = findWordlist('passwords')
    if (!passList) {
      return { args: [], error: 'No password provided and no wordlist found' }
    }
    args.push('-P', passList)
  }

  // Threads (limit for safety)
  const threads = Math.min(params.threads || 4, 16)
  args.push('-t', String(threads))

  // Verbose output for parsing
  args.push('-V')

  // Stop after first found
  args.push('-f')

  // Target and service
  const port = params.port || DEFAULT_PORTS[params.service] || 22

  if (params.service === 'http-post-form' && params.httpPath && params.httpForm) {
    args.push(`${params.target}`)
    args.push('-s', String(port))
    args.push('http-post-form')
    args.push(`${params.httpPath}:${params.httpForm}`)
  } else {
    args.push('-s', String(port))
    args.push(params.target)
    args.push(params.service)
  }

  return { args }
}

export const hydraAgent = defineAgent<typeof hydraParams, HydraResult>({
  name: 'hydra',
  description: 'Credential brute forcer. Tests username/password combinations against services (SSH, FTP, HTTP, SMB, etc.). Use responsibly.',
  systemPrompt: HYDRA_SYSTEM_PROMPT,
  parameters: hydraParams,

  async execute(params: HydraParams, context): Promise<AgentResult<HydraResult>> {
    // Build command
    const { args, error } = buildHydraCommand(params)
    if (error) {
      return createErrorResult('hydra', error, EMPTY_RESULT)
    }

    // Run hydra
    const attackResult = await executeProcess('hydra', args, {
      timeoutMs: 300000, // 5 minutes
      toolName: 'hydra',
      successCheck: () => true, // Hydra returns 0 for both found and not found
    })

    if (!attackResult.success && !attackResult.output) {
      return createErrorResult('hydra', attackResult.error, {
        ...EMPTY_RESULT,
        errors: [attackResult.error || 'Unknown error'],
      })
    }

    // Quick check for found credentials in output
    const hasFoundCreds = attackResult.output.includes('[') && attackResult.output.includes('host:')

    // Parse with LLM
    return parseToolOutput<HydraResult>({
      toolName: 'hydra',
      systemPrompt: HYDRA_SYSTEM_PROMPT,
      rawOutput: attackResult.output,
      context,
      emptyResult: {
        ...EMPTY_RESULT,
        status: hasFoundCreds ? 'success' : 'no_creds',
      },
      buildSummary: (parsed) => {
        const credCount = parsed.foundCredentials.length

        if (credCount > 0) {
          const firstCred = parsed.foundCredentials[0]
          return `Found ${credCount} valid creds: ${firstCred.username}:${firstCred.password} on ${params.service}`
        }

        return `No credentials found after ${parsed.attemptedCombinations} attempts`
      },
    })
  },
})
