/**
 * Recon Agent - Parallel Reconnaissance Orchestrator
 *
 * Orchestrates nmap, gobuster, nikto, hydra, searchsploit in parallel.
 * Correlates findings into an actionable attack surface map.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult, type AgentContext } from './types'
import { executeAgentLLM } from '../services/agent-executor'
import { executeProcess, getTimeoutForScanType } from '../utils/process-executor'
import { findWordlist } from '../utils/wordlist-finder'

const RECON_SYSTEM_PROMPT = `You are a reconnaissance orchestration agent. You coordinate multiple scanning tools and correlate their findings into an actionable attack surface map.

Your job:
1. Analyze scan results from nmap, gobuster, nikto, hydra, searchsploit
2. Correlate findings (e.g., port 80 open -> gobuster finds /admin -> nikto finds outdated Apache)
3. Identify attack vectors from combined intelligence
4. Prioritize targets by exploitability
5. Suggest next steps based on findings

Output format (JSON):
{
  "target": "10.10.10.1",
  "attack_surface": {
    "network": {
      "open_ports": [22, 80, 443],
      "services": [
        {
          "port": 80,
          "service": "http",
          "product": "Apache",
          "version": "2.4.49",
          "vulnerabilities": ["CVE-2021-41773"],
          "attack_priority": "high"
        }
      ]
    },
    "web": {
      "technologies": ["Apache/2.4.49", "PHP/7.4"],
      "interesting_paths": [{"path": "/admin", "status": 200, "notes": "Admin panel"}],
      "vulnerabilities": [{"type": "outdated_software", "detail": "Apache 2.4.49 path traversal", "severity": "critical"}]
    }
  },
  "attack_vectors": [
    {
      "name": "Apache Path Traversal RCE",
      "entry_point": "port 80",
      "technique": "CVE-2021-41773",
      "difficulty": "easy",
      "impact": "critical"
    }
  ],
  "prioritized_targets": [{"target": "80/tcp", "reason": "Known RCE", "priority": 1}],
  "recommendations": ["Start with CVE-2021-41773"],
  "next_scans": [{"tool": "hydra", "target": "/admin", "reason": "Brute force"}]
}

Only output JSON, nothing else.`

const reconParams = z.object({
  target: z.string().describe('Target IP or hostname'),
  scanTypes: z.array(z.enum(['quick', 'full', 'web', 'stealth', 'creds', 'exploits']))
    .optional().default(['quick', 'web'])
    .describe('Scan types: quick (nmap top ports), full (all ports), web (gobuster+nikto), stealth (SYN), creds (hydra), exploits (searchsploit)'),
  ports: z.string().optional().describe('Specific ports to scan'),
  maxParallel: z.number().optional().default(4).describe('Max parallel scans'),
  existingFindings: z.record(z.any()).optional().describe('Previous scan results to correlate'),
})

type ReconParams = z.infer<typeof reconParams>

export interface ReconResult {
  target: string
  attack_surface: {
    network: { open_ports: number[]; services: Array<{ port: number; service: string; product?: string; version?: string; vulnerabilities: string[]; attack_priority: string }> }
    web: { technologies: string[]; interesting_paths: Array<{ path: string; status: number; notes?: string }>; vulnerabilities: Array<{ type: string; detail: string; severity: string }> }
  }
  attack_vectors: Array<{ name: string; entry_point: string; technique: string; difficulty: string; impact: string }>
  prioritized_targets: Array<{ target: string; reason: string; priority: number }>
  recommendations: string[]
  next_scans: Array<{ tool: string; target: string; reason: string }>
  scan_stats?: { scans_run: string[]; duration_ms: number }
}

const EMPTY_RESULT: ReconResult = {
  target: '',
  attack_surface: {
    network: { open_ports: [], services: [] },
    web: { technologies: [], interesting_paths: [], vulnerabilities: [] },
  },
  attack_vectors: [],
  prioritized_targets: [],
  recommendations: [],
  next_scans: [],
}

// Tool execution functions (merged from deleted agents)
async function runNmap(target: string, scanType: string, ports?: string): Promise<string> {
  const args: string[] = []

  switch (scanType) {
    case 'quick': args.push('-F'); break
    case 'full': args.push('-p-'); break
    case 'stealth': args.push('-sS'); break
    default: args.push('-sV', '-sC'); break
  }

  args.push('-T4')
  if (ports) args.push('-p', ports)
  args.push(target)

  const result = await executeProcess('nmap', args, {
    timeoutMs: getTimeoutForScanType(scanType),
    toolName: 'nmap',
    successCheck: (code, output) => code === 0 || output.includes('Nmap scan report'),
  })

  return result.output || ''
}

async function runGobuster(url: string): Promise<string> {
  const wordlist = findWordlist('directory')
  if (!wordlist) return ''

  const args = [
    'dir',
    '-u', url.includes('://') ? url : `http://${url}`,
    '-w', wordlist,
    '-x', 'php,html,txt,bak',
    '-t', '10',
    '-s', '200,204,301,302,307,401,403',
    '-q', '-e',
  ]

  const result = await executeProcess('gobuster', args, {
    timeoutMs: 300000,
    toolName: 'gobuster',
  })

  return result.output || ''
}

async function runNikto(target: string): Promise<string> {
  const url = target.includes('://') ? target : `http://${target}`
  const args = ['-h', url, '-Pause', '0', '-Display', 'V']

  const result = await executeProcess('nikto', args, {
    timeoutMs: 600000,
    toolName: 'nikto',
    successCheck: (code, output) => code === 0 || output.includes('host(s) tested'),
  })

  return result.output || ''
}

async function runHydra(target: string, service: string, port?: number): Promise<string> {
  const userList = findWordlist('usernames')
  const passList = findWordlist('passwords')
  if (!userList || !passList) return ''

  const args = [
    '-L', userList,
    '-P', passList,
    '-t', '4',
    '-V', '-f',
    '-s', String(port || 22),
    target,
    service,
  ]

  const result = await executeProcess('hydra', args, {
    timeoutMs: 300000,
    toolName: 'hydra',
    successCheck: () => true,
  })

  return result.output || ''
}

async function runSearchsploit(query: string): Promise<string> {
  const args = ['--exclude=dos', '-m', ...query.split(' ')]

  const result = await executeProcess('searchsploit', args, {
    timeoutMs: 30000,
    toolName: 'searchsploit',
  })

  return result.output || ''
}

async function runParallelScans(
  target: string,
  scanTypes: string[],
  ports: string | undefined,
  maxParallel: number
): Promise<{ results: Record<string, string>; scansRun: string[] }> {
  const scansRun: string[] = []
  const results: Record<string, string> = {}
  const scanQueue: Array<{ name: string; run: () => Promise<void> }> = []

  if (scanTypes.includes('quick') || scanTypes.includes('full') || scanTypes.includes('stealth')) {
    const scanType = scanTypes.includes('stealth') ? 'stealth' : scanTypes.includes('full') ? 'full' : 'quick'
    scanQueue.push({
      name: 'nmap',
      run: async () => {
        results.nmap = await runNmap(target, scanType, ports)
        if (results.nmap) scansRun.push('nmap')
      },
    })
  }

  if (scanTypes.includes('web') || scanTypes.includes('full')) {
    scanQueue.push({
      name: 'gobuster',
      run: async () => {
        results.gobuster = await runGobuster(target)
        if (results.gobuster) scansRun.push('gobuster')
      },
    })
    scanQueue.push({
      name: 'nikto',
      run: async () => {
        results.nikto = await runNikto(target)
        if (results.nikto) scansRun.push('nikto')
      },
    })
  }

  if (scanTypes.includes('creds')) {
    scanQueue.push({
      name: 'hydra',
      run: async () => {
        results.hydra = await runHydra(target, 'ssh')
        if (results.hydra) scansRun.push('hydra')
      },
    })
  }

  if (scanTypes.includes('exploits')) {
    scanQueue.push({
      name: 'searchsploit',
      run: async () => {
        results.searchsploit = await runSearchsploit(target)
        if (results.searchsploit) scansRun.push('searchsploit')
      },
    })
  }

  // Run with budget control
  const batches: typeof scanQueue[] = []
  for (let i = 0; i < scanQueue.length; i += maxParallel) {
    batches.push(scanQueue.slice(i, i + maxParallel))
  }

  for (const batch of batches) {
    await Promise.all(batch.map(scan => scan.run().catch(() => {})))
  }

  return { results, scansRun }
}

export const reconAgent = defineAgent<typeof reconParams, ReconResult>({
  name: 'recon',
  description: 'Parallel reconnaissance orchestrator. Runs nmap/gobuster/nikto/hydra/searchsploit, correlates findings.',
  systemPrompt: RECON_SYSTEM_PROMPT,
  parameters: reconParams,

  async execute(params: ReconParams, context: AgentContext): Promise<AgentResult<ReconResult>> {
    const startTime = Date.now()

    let scanResults: { results: Record<string, string>; scansRun: string[] }

    if (params.existingFindings && Object.keys(params.existingFindings).length > 0) {
      scanResults = {
        results: params.existingFindings as Record<string, string>,
        scansRun: ['existing'],
      }
    } else {
      scanResults = await runParallelScans(params.target, params.scanTypes, params.ports, params.maxParallel)
    }

    // Build prompt for LLM correlation
    let userPrompt = `Target: ${params.target}\n\n`

    for (const [tool, output] of Object.entries(scanResults.results)) {
      if (output) {
        const truncated = output.length > 3000 ? output.slice(0, 3000) + '\n...[truncated]' : output
        userPrompt += `=== ${tool.toUpperCase()} ===\n${truncated}\n\n`
      }
    }

    userPrompt += 'Correlate these findings into a comprehensive attack surface map.'

    const result = await executeAgentLLM({
      name: 'recon',
      systemPrompt: RECON_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    const duration = Date.now() - startTime

    if (!result.success) {
      return {
        success: false,
        summary: 'Recon correlation failed',
        data: { ...EMPTY_RESULT, target: params.target, scan_stats: { scans_run: scanResults.scansRun, duration_ms: duration } },
      }
    }

    try {
      const parsed = JSON.parse(result.text) as ReconResult
      parsed.target = params.target
      parsed.scan_stats = { scans_run: scanResults.scansRun, duration_ms: duration }

      const portCount = parsed.attack_surface.network.open_ports.length
      const vectorCount = parsed.attack_vectors.length
      const topVector = parsed.attack_vectors[0]

      return {
        success: true,
        summary: [
          `${portCount} open ports`,
          `${vectorCount} attack vectors`,
          topVector ? `Top: ${topVector.name}` : '',
        ].filter(Boolean).join(', '),
        data: parsed,
      }
    } catch {
      return {
        success: true,
        summary: `Recon complete (${scanResults.scansRun.length} scans)`,
        data: { ...EMPTY_RESULT, target: params.target, scan_stats: { scans_run: scanResults.scansRun, duration_ms: duration } },
      }
    }
  },
})
