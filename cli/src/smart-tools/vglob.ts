/**
 * VGlob Agent - Service Fingerprint to Exploit Matching
 *
 * Like glob but for vulnerabilities - pattern match service fingerprints
 * against CVE/exploit databases.
 *
 * Input: "Apache/2.4.49", "vsftpd 2.3.4", "OpenSSH 7.2p2"
 * Output: Prioritized exploits, Metasploit modules, attack chains
 *
 * Uses generator pattern with run_exploit_match tool.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const EXPLOIT_MATCHER_SYSTEM_PROMPT = `You are an exploit matching specialist. Given service fingerprints (software name, version, banner), you find matching exploits and build attack chains.

Your job:
1. Parse service fingerprints to extract: software name, version, configuration hints
2. Match against known CVEs and exploits
3. Build exploitation paths (which exploit, prerequisites, success likelihood)
4. Prioritize by: ease of exploitation, impact, reliability

Output format (JSON):
{
  "fingerprints_analyzed": [
    {
      "raw": "Apache/2.4.49 (Ubuntu)",
      "software": "Apache HTTP Server",
      "version": "2.4.49",
      "os_hint": "Ubuntu",
      "configuration_hints": ["mod_cgi possibly enabled"]
    }
  ],
  "matches": [
    {
      "fingerprint": "Apache/2.4.49",
      "cve": "CVE-2021-41773",
      "title": "Apache HTTP Server Path Traversal and RCE",
      "severity": "critical",
      "cvss": 9.8,
      "exploitability": {
        "score": "trivial",
        "prerequisites": ["mod_cgi or cgid enabled"],
        "reliability": "high",
        "public_exploits": true
      },
      "exploits": [
        {
          "type": "exploit-db",
          "id": "50383",
          "title": "Apache HTTP Server 2.4.49 - Path Traversal & RCE",
          "verified": true
        },
        {
          "type": "metasploit",
          "module": "exploit/multi/http/apache_normalize_path_rce",
          "rank": "excellent"
        }
      ],
      "attack_chain": {
        "steps": ["Verify version", "Check mod_cgi", "Send payload", "Execute commands"],
        "tools_needed": ["curl", "nc"],
        "time_estimate": "< 5 minutes"
      },
      "mitigations": ["Upgrade to 2.4.51+"],
      "references": ["https://nvd.nist.gov/vuln/detail/CVE-2021-41773"]
    }
  ],
  "no_matches": [
    {
      "fingerprint": "OpenSSH 8.9p1",
      "reason": "No known public exploits",
      "suggestions": ["Check for weak credentials"]
    }
  ],
  "attack_priority": [
    {
      "rank": 1,
      "target": "Apache/2.4.49",
      "exploit": "CVE-2021-41773",
      "reason": "Trivial RCE, public exploits available"
    }
  ],
  "recommended_workflow": ["1. Verify Apache version", "2. Run exploit"]
}

Matching rules:
1. Exact version match > Version range match > Major version match
2. Verified exploits > Unverified
3. Metasploit > Standalone scripts
4. RCE > Auth bypass > LFI > Info disclosure

Known high-value targets (auto-flag):
- Apache 2.4.49/2.4.50 (CVE-2021-41773)
- vsftpd 2.3.4 (backdoor)
- ProFTPD 1.3.5 (mod_copy RCE)
- Samba 4.5.9 (CVE-2017-7494)
- SMBv1 (EternalBlue)

Only output JSON, nothing else.`

const vglobParams = z.object({
  fingerprints: z.array(z.object({
    banner: z.string().describe('Raw banner/version string'),
    port: z.number().optional(),
    protocol: z.string().optional(),
    source: z.string().optional(),
  })).describe('Service fingerprints to match against exploits'),
  prioritize: z.enum(['rce', 'auth_bypass', 'info_disclosure', 'any'])
    .optional().default('any')
    .describe('Type of exploit to prioritize'),
  includeMetasploit: z.boolean().optional().default(true)
    .describe('Include Metasploit module recommendations'),
})

export interface ExploitMatch {
  fingerprint: string
  cve?: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  cvss?: number
  exploitability: {
    score: 'trivial' | 'easy' | 'moderate' | 'hard'
    prerequisites: string[]
    reliability: 'high' | 'medium' | 'low'
    public_exploits: boolean
  }
  exploits: Array<{ type: string; id?: string; module?: string; title?: string; verified?: boolean; rank?: string }>
  attack_chain: { steps: string[]; tools_needed: string[]; time_estimate: string }
  mitigations: string[]
  references: string[]
}

export interface VglobResult {
  fingerprints_analyzed: Array<{ raw: string; software: string; version?: string; os_hint?: string; configuration_hints: string[] }>
  matches: ExploitMatch[]
  no_matches: Array<{ fingerprint: string; reason: string; suggestions: string[] }>
  attack_priority: Array<{ rank: number; target: string; exploit: string; reason: string }>
  recommended_workflow: string[]
}

export const vglob = defineGeneratorAgent<typeof vglobParams, VglobResult>({
  name: 'vglob',
  id: 'vglob',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Pattern match service fingerprints to exploits. Finds CVEs, Metasploit modules, attack chains.',

  spawnerPrompt: 'Matches service fingerprints (banners, versions) against exploit databases. Returns CVEs, Metasploit modules, and attack chains. Use after reconnaissance.',

  outputMode: 'structured_output',
  toolNames: ['run_exploit_match'],

  systemPrompt: EXPLOIT_MATCHER_SYSTEM_PROMPT,

  instructionsPrompt: `Analyze the fingerprints and search results to build a comprehensive exploit matching report.

Focus on:
1. Parsing each fingerprint to extract software, version, and hints
2. Matching against known CVEs and exploits
3. Building attack chains with specific steps
4. Prioritizing by ease of exploitation and impact
5. Providing actionable workflow for exploitation`,

  parameters: vglobParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    const { fingerprints } = params as z.infer<typeof vglobParams>

    // Step 1: Run exploit matching
    yield {
      toolName: 'run_exploit_match',
      input: {
        fingerprints: fingerprints.map(f => ({
          banner: f.banner,
          port: f.port,
        })),
      },
    }

    // Step 2: Analyze and build attack chains
    yield 'STEP'
  },
})
