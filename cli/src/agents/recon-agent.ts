/**
 * Recon Agent - Parallel Reconnaissance Orchestrator
 *
 * Orchestrates nmap, gobuster, nikto, hydra, searchsploit in parallel.
 * Correlates findings into an actionable attack surface map.
 * Uses generator pattern with run_recon_scans tool.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

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
})

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
}

export const reconAgent = defineGeneratorAgent<typeof reconParams, ReconResult>({
  name: 'recon',
  id: 'recon',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Parallel reconnaissance orchestrator. Runs nmap/gobuster/nikto/hydra/searchsploit, correlates findings.',

  spawnerPrompt: 'Runs parallel reconnaissance scans (nmap, gobuster, nikto, hydra, searchsploit) and correlates findings into an attack surface map. Use for initial target enumeration.',

  outputMode: 'structured_output',
  toolNames: ['run_recon_scans'],

  systemPrompt: RECON_SYSTEM_PROMPT,

  instructionsPrompt: `Analyze the scan results and correlate findings into a comprehensive attack surface map.

Focus on:
1. Which ports/services are open and their versions
2. Any known vulnerabilities for the identified software
3. Interesting web paths and what they might contain
4. Prioritized attack vectors based on ease of exploitation and impact
5. Recommended next steps for further enumeration or exploitation`,

  parameters: reconParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    const { target, scanTypes, ports, maxParallel } = params as z.infer<typeof reconParams>

    // Step 1: Run parallel recon scans
    yield {
      toolName: 'run_recon_scans',
      input: {
        target,
        scanTypes,
        ports,
        maxParallel,
      },
    }

    // Step 2: Analyze and correlate findings
    yield 'STEP'
  },
})
