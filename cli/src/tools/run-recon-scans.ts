/**
 * Run Recon Scans Tool
 *
 * Runs parallel reconnaissance scans (nmap, gobuster, nikto, hydra, searchsploit).
 * Handles parallelization internally for efficiency.
 */

import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { executeProcess, getTimeoutForScanType } from '../utils/process-executor'
import { findWordlist } from '../utils/wordlist-finder'

const runReconScansParams = z.object({
  target: z.string().describe('Target IP or hostname'),
  scanTypes: z.array(z.enum(['quick', 'full', 'web', 'stealth', 'creds', 'exploits']))
    .default(['quick', 'web'])
    .describe('Scan types to run'),
  ports: z.string().optional().describe('Specific ports to scan'),
  maxParallel: z.number().optional().default(4).describe('Max parallel scans'),
})

// Tool execution functions
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
  const args = ['--exclude=dos', '-w', query]

  const result = await executeProcess('searchsploit', args, {
    timeoutMs: 30000,
    toolName: 'searchsploit',
  })

  return result.output || ''
}

export const runReconScans = defineTool({
  name: 'run_recon_scans',
  description: 'Run parallel reconnaissance scans (nmap, gobuster, nikto, hydra, searchsploit) against a target.',
  parameters: runReconScansParams,

  async execute({ target, scanTypes, ports, maxParallel }): Promise<ToolResult> {
    const startTime = Date.now()
    const scansRun: string[] = []
    const results: Record<string, string> = {}
    const scanQueue: Array<{ name: string; run: () => Promise<void> }> = []

    // Build scan queue
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

    // Run scans in parallel batches
    const batches: typeof scanQueue[] = []
    for (let i = 0; i < scanQueue.length; i += maxParallel) {
      batches.push(scanQueue.slice(i, i + maxParallel))
    }

    for (const batch of batches) {
      await Promise.all(batch.map(scan => scan.run().catch(() => {})))
    }

    const duration = Date.now() - startTime

    // Build combined output
    const outputParts: string[] = [`Target: ${target}`, '']

    for (const [tool, output] of Object.entries(results)) {
      if (output) {
        const truncated = output.length > 3000 ? output.slice(0, 3000) + '\n...[truncated]' : output
        outputParts.push(`=== ${tool.toUpperCase()} ===`)
        outputParts.push(truncated)
        outputParts.push('')
      }
    }

    outputParts.push(`Scans completed: ${scansRun.join(', ')}`)
    outputParts.push(`Duration: ${Math.round(duration / 1000)}s`)

    return {
      success: scansRun.length > 0,
      summary: `${scansRun.length} scans completed in ${Math.round(duration / 1000)}s`,
      fullResult: outputParts.join('\n'),
      displayName: 'Recon',
      displayInput: `${target} (${scanTypes.join(', ')})`,
      displayColor: scansRun.length > 0 ? 'success' : 'error',
    }
  },
})
