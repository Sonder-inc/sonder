/**
 * Nmap Agent - Network Reconnaissance
 *
 * Runs nmap scans and returns structured, concise results.
 * Prevents context rot by summarizing raw nmap output.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeProcess, getTimeoutForScanType } from '../utils/process-executor'
import { parseToolOutput, createErrorResult, buildItemSummary } from '../services/agent-parser'

const NMAP_SYSTEM_PROMPT = `You are an nmap output analyzer. Parse the raw nmap scan results and extract key information.

Output format (JSON only):
{
  "openPorts": [
    { "port": 22, "protocol": "tcp", "state": "open", "service": "ssh", "version": "OpenSSH 7.9" }
  ],
  "closedPorts": 995,
  "filteredPorts": 3,
  "os": "Linux 4.15 - 5.6",
  "osAccuracy": 95,
  "hostStatus": "up",
  "latency": "0.045s",
  "vulnerabilities": [
    { "port": 445, "vuln": "SMBv1 enabled", "severity": "high" }
  ],
  "recommendations": ["Check SMB for EternalBlue", "SSH version may be vulnerable to CVE-XXX"]
}

Focus on:
1. Open ports and their services/versions
2. OS detection results
3. Any vulnerability script results
4. Actionable recommendations for pentesting

Only output JSON, nothing else.`

const nmapParams = z.object({
  target: z.string().describe('Target IP, hostname, or CIDR range'),
  ports: z.string().optional().describe('Port specification (e.g., "22,80,443" or "1-1000" or "-" for all)'),
  scanType: z.enum(['quick', 'full', 'stealth', 'service', 'vuln']).optional().default('service')
    .describe('Scan type: quick (top 100), full (all ports), stealth (SYN), service (version detection), vuln (vulnerability scripts)'),
  timing: z.enum(['0', '1', '2', '3', '4', '5']).optional().default('4')
    .describe('Timing template: 0=paranoid, 3=normal, 5=insane'),
  scripts: z.string().optional().describe('NSE scripts to run (e.g., "vuln,exploit")'),
})

type NmapParams = z.infer<typeof nmapParams>

export interface PortInfo {
  port: number
  protocol: string
  state: string
  service: string
  version?: string
}

export interface VulnInfo {
  port: number
  vuln: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface NmapResult {
  openPorts: PortInfo[]
  closedPorts: number
  filteredPorts: number
  os?: string
  osAccuracy?: number
  hostStatus: 'up' | 'down' | 'unknown'
  latency?: string
  vulnerabilities: VulnInfo[]
  recommendations: string[]
  rawOutput?: string
}

const EMPTY_RESULT: NmapResult = {
  openPorts: [],
  closedPorts: 0,
  filteredPorts: 0,
  hostStatus: 'unknown',
  vulnerabilities: [],
  recommendations: [],
}

/**
 * Build nmap command from parameters
 */
function buildNmapCommand(params: NmapParams): string[] {
  const args: string[] = []

  // Scan type
  switch (params.scanType) {
    case 'quick':
      args.push('-F') // Fast scan (top 100 ports)
      break
    case 'full':
      args.push('-p-') // All 65535 ports
      break
    case 'stealth':
      args.push('-sS') // SYN scan
      break
    case 'service':
      args.push('-sV') // Version detection
      args.push('-sC') // Default scripts
      break
    case 'vuln':
      args.push('-sV')
      args.push('--script=vuln')
      break
  }

  // Timing
  args.push(`-T${params.timing}`)

  // Ports
  if (params.ports) {
    args.push('-p', params.ports)
  }

  // Custom scripts
  if (params.scripts) {
    args.push(`--script=${params.scripts}`)
  }

  // OS detection for service/vuln scans
  if (params.scanType === 'service' || params.scanType === 'vuln') {
    args.push('-O') // OS detection
  }

  // Target
  args.push(params.target)

  return args
}

export const nmapAgent = defineAgent<typeof nmapParams, NmapResult>({
  name: 'nmap',
  description: 'Network reconnaissance scanner. Discovers open ports, services, OS, and vulnerabilities. Returns structured summary.',
  systemPrompt: NMAP_SYSTEM_PROMPT,
  parameters: nmapParams,

  async execute(params: NmapParams, context): Promise<AgentResult<NmapResult>> {
    const args = buildNmapCommand(params)
    const timeoutMs = getTimeoutForScanType(params.scanType || 'service')

    // Run nmap
    const scanResult = await executeProcess('nmap', args, {
      timeoutMs,
      toolName: 'nmap',
      successCheck: (code, output) => code === 0 || output.includes('Nmap scan report'),
    })

    if (!scanResult.success && !scanResult.output) {
      return createErrorResult('nmap', scanResult.error, EMPTY_RESULT)
    }

    // Parse with LLM
    return parseToolOutput<NmapResult>({
      toolName: 'nmap',
      systemPrompt: NMAP_SYSTEM_PROMPT,
      rawOutput: scanResult.output,
      context,
      emptyResult: EMPTY_RESULT,
      buildSummary: (parsed) => {
        const portSummary = buildItemSummary(
          parsed.openPorts,
          (p) => `${(p as PortInfo).service}(${(p as PortInfo).port})`,
          'ports open'
        )
        const vulnCount = parsed.vulnerabilities.length

        return [
          portSummary,
          parsed.os ? `OS: ${parsed.os}` : '',
          vulnCount > 0 ? `${vulnCount} potential vulns` : '',
        ].filter(Boolean).join('. ')
      },
    })
  },
})
