/**
 * Nikto Agent - Web Vulnerability Scanner
 *
 * Runs nikto web server scanner and returns categorized findings.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeProcess } from '../utils/process-executor'
import { parseToolOutput, createErrorResult } from '../services/agent-parser'

const NIKTO_SYSTEM_PROMPT = `You are a nikto output analyzer. Parse the web vulnerability scan results and categorize findings.

Output format (JSON only):
{
  "vulnerabilities": [
    {
      "id": "OSVDB-3092",
      "path": "/admin/",
      "description": "Admin directory found",
      "severity": "medium",
      "cve": null
    },
    {
      "id": "CVE-2014-6271",
      "path": "/cgi-bin/test.cgi",
      "description": "Shellshock vulnerability",
      "severity": "critical",
      "cve": "CVE-2014-6271"
    }
  ],
  "misconfigurations": [
    {
      "type": "Missing Header",
      "detail": "X-Frame-Options header not set",
      "severity": "low"
    },
    {
      "type": "Server Banner",
      "detail": "Apache/2.4.49 exposed",
      "severity": "info"
    }
  ],
  "interestingFiles": [
    { "path": "/robots.txt", "note": "Contains disallowed paths" },
    { "path": "/.git/", "note": "Git directory exposed" }
  ],
  "serverInfo": {
    "software": "Apache/2.4.49",
    "os": "Ubuntu",
    "technologies": ["PHP/7.4", "OpenSSL/1.1.1"]
  },
  "totalChecks": 6544,
  "itemsFound": 12,
  "recommendations": [
    "Critical: Check /cgi-bin/ for Shellshock",
    "Enumerate /admin/ for login bypass",
    "Download /.git/ with git-dumper"
  ]
}

Categorize by severity:
- critical: RCE, SQLi, known CVEs with public exploits
- high: Auth bypass, file inclusion, sensitive data exposure
- medium: Information disclosure, misconfigurations
- low: Missing headers, version disclosure
- info: Informational findings

Only output JSON, nothing else.`

const niktoParams = z.object({
  target: z.string().describe('Target URL or IP (e.g., http://10.10.10.1 or 10.10.10.1)'),
  port: z.number().optional().default(80).describe('Target port'),
  ssl: z.boolean().optional().default(false).describe('Use SSL/HTTPS'),
  tuning: z.string().optional()
    .describe('Scan tuning (1=interesting files, 2=misconfiguration, 3=info disclosure, 4=injection, 5=remote file retrieval, 6=denial of service, 7=remote source inclusion, 8=command execution, 9=SQL injection, 0=file upload, a=auth bypass, b=software ID, c=remote source inclusion, d=webservice, e=admin console, x=reverse tuning)'),
  timeout: z.number().optional().default(10).describe('Timeout per request in seconds'),
})

type NiktoParams = z.infer<typeof niktoParams>

export interface Vulnerability {
  id: string
  path: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  cve?: string | null
}

export interface Misconfiguration {
  type: string
  detail: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
}

export interface InterestingFile {
  path: string
  note: string
}

export interface ServerInfo {
  software?: string
  os?: string
  technologies: string[]
}

export interface NiktoResult {
  vulnerabilities: Vulnerability[]
  misconfigurations: Misconfiguration[]
  interestingFiles: InterestingFile[]
  serverInfo: ServerInfo
  totalChecks: number
  itemsFound: number
  recommendations: string[]
  rawOutput?: string
}

const EMPTY_RESULT: NiktoResult = {
  vulnerabilities: [],
  misconfigurations: [],
  interestingFiles: [],
  serverInfo: { technologies: [] },
  totalChecks: 0,
  itemsFound: 0,
  recommendations: [],
}

/**
 * Build nikto command from parameters
 */
function buildNiktoCommand(params: NiktoParams): string[] {
  const args: string[] = []

  // Target
  let target = params.target
  if (!target.startsWith('http')) {
    target = params.ssl ? `https://${target}` : `http://${target}`
  }
  args.push('-h', target)

  // Port
  args.push('-p', String(params.port))

  // SSL
  if (params.ssl) {
    args.push('-ssl')
  }

  // Tuning
  if (params.tuning) {
    args.push('-Tuning', params.tuning)
  }

  // Timeout
  args.push('-timeout', String(params.timeout))

  // Don't pause
  args.push('-Pause', '0')

  // Output format (regular text, easier to parse)
  args.push('-Display', 'V')

  return args
}

export const niktoAgent = defineAgent<typeof niktoParams, NiktoResult>({
  name: 'nikto',
  description: 'Web vulnerability scanner. Finds misconfigurations, dangerous files, and known vulnerabilities in web servers.',
  systemPrompt: NIKTO_SYSTEM_PROMPT,
  parameters: niktoParams,

  async execute(params: NiktoParams, context): Promise<AgentResult<NiktoResult>> {
    const args = buildNiktoCommand(params)

    // Run nikto
    const scanResult = await executeProcess('nikto', args, {
      timeoutMs: 600000, // 10 minutes
      toolName: 'nikto',
      successCheck: (code, output) => code === 0 || output.includes('host(s) tested'),
    })

    if (!scanResult.success && !scanResult.output) {
      return createErrorResult('nikto', scanResult.error, EMPTY_RESULT)
    }

    // Parse with LLM
    return parseToolOutput<NiktoResult>({
      toolName: 'nikto',
      systemPrompt: NIKTO_SYSTEM_PROMPT,
      rawOutput: scanResult.output,
      context,
      emptyResult: EMPTY_RESULT,
      buildSummary: (parsed) => {
        const criticalCount = parsed.vulnerabilities.filter(v => v.severity === 'critical').length
        const highCount = parsed.vulnerabilities.filter(v => v.severity === 'high').length
        const totalVulns = parsed.vulnerabilities.length

        return [
          `${parsed.itemsFound} findings`,
          totalVulns > 0 ? `${totalVulns} vulns` : '',
          criticalCount > 0 ? `${criticalCount} critical` : '',
          highCount > 0 ? `${highCount} high` : '',
          parsed.serverInfo.software ? `Server: ${parsed.serverInfo.software}` : '',
        ].filter(Boolean).join(', ')
      },
    })
  },
})
