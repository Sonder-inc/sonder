/**
 * VGlob Agent - Service Fingerprint to Exploit Matching
 *
 * Like glob but for vulnerabilities - pattern match service fingerprints
 * against CVE/exploit databases.
 *
 * Input: "Apache/2.4.49", "vsftpd 2.3.4", "OpenSSH 7.2p2"
 * Output: Prioritized exploits, Metasploit modules, attack chains
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'
import { executeProcess } from '../utils/process-executor'

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
        "prerequisites": ["mod_cgi or cgid enabled", "Directory traversal not patched"],
        "reliability": "high",
        "public_exploits": true
      },
      "exploits": [
        {
          "type": "exploit-db",
          "id": "50383",
          "title": "Apache HTTP Server 2.4.49 - Path Traversal & RCE",
          "language": "python",
          "verified": true
        },
        {
          "type": "metasploit",
          "module": "exploit/multi/http/apache_normalize_path_rce",
          "rank": "excellent"
        },
        {
          "type": "nuclei",
          "template": "CVE-2021-41773",
          "severity": "critical"
        }
      ],
      "attack_chain": {
        "steps": [
          "Verify version with banner grab",
          "Check if mod_cgi enabled: /cgi-bin/ returns 403 (not 404)",
          "Send path traversal payload to /cgi-bin/.%2e/%2e%2e/..../bin/sh",
          "Execute commands, establish reverse shell"
        ],
        "tools_needed": ["curl", "nc"],
        "time_estimate": "< 5 minutes"
      },
      "mitigations": ["Upgrade to 2.4.51+", "Disable mod_cgi if not needed"],
      "references": [
        "https://nvd.nist.gov/vuln/detail/CVE-2021-41773",
        "https://www.exploit-db.com/exploits/50383"
      ]
    }
  ],
  "no_matches": [
    {
      "fingerprint": "OpenSSH 8.9p1",
      "reason": "No known public exploits for this version",
      "suggestions": ["Check for weak credentials", "Look for key reuse"]
    }
  ],
  "attack_priority": [
    {
      "rank": 1,
      "target": "Apache/2.4.49 on port 80",
      "exploit": "CVE-2021-41773",
      "reason": "Trivial RCE, public exploits available, high reliability"
    }
  ],
  "recommended_workflow": [
    "1. Verify Apache 2.4.49 with curl -I",
    "2. Check mod_cgi: curl http://target/cgi-bin/",
    "3. If 403, run: msfconsole -x 'use exploit/multi/http/apache_normalize_path_rce; set RHOSTS target; run'",
    "4. Alternative: python3 50383.py target 80 /bin/bash"
  ]
}

Matching rules:
1. Exact version match > Version range match > Major version match
2. Verified exploits > Unverified
3. Metasploit > Standalone scripts (easier to use)
4. RCE > Auth bypass > LFI > Info disclosure
5. Recent CVEs (2020+) > Old ones (unless classics)

Known high-value targets (auto-flag):
- Apache 2.4.49/2.4.50 (CVE-2021-41773)
- vsftpd 2.3.4 (backdoor)
- ProFTPD 1.3.5 (mod_copy RCE)
- Samba 4.5.9 (CVE-2017-7494)
- Drupal 7.x < 7.58 (Drupalgeddon)
- WordPress < 5.0 (various)
- OpenSSH < 7.7 (user enumeration)
- SMBv1 (EternalBlue)

Only output JSON, nothing else.`

const vglobParams = z.object({
  fingerprints: z.array(z.object({
    banner: z.string().describe('Raw banner/version string (e.g., "Apache/2.4.49 (Ubuntu)")'),
    port: z.number().optional(),
    protocol: z.string().optional(),
    source: z.string().optional().describe('Where this fingerprint came from (nmap, curl, nc)'),
  })).describe('Service fingerprints to match against exploits'),
  prioritize: z.enum(['rce', 'auth_bypass', 'info_disclosure', 'any'])
    .optional().default('any')
    .describe('Type of exploit to prioritize'),
  includeMetasploit: z.boolean().optional().default(true)
    .describe('Include Metasploit module recommendations'),
})

type VglobParams = z.infer<typeof vglobParams>

export interface ParsedFingerprint {
  raw: string
  software: string
  version?: string
  os_hint?: string
  configuration_hints: string[]
}

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
  exploits: Array<{
    type: string
    id?: string
    module?: string
    title?: string
    template?: string
    language?: string
    verified?: boolean
    rank?: string
    severity?: string
  }>
  attack_chain: {
    steps: string[]
    tools_needed: string[]
    time_estimate: string
  }
  mitigations: string[]
  references: string[]
}

export interface VglobResult {
  fingerprints_analyzed: ParsedFingerprint[]
  matches: ExploitMatch[]
  no_matches: Array<{ fingerprint: string; reason: string; suggestions: string[] }>
  attack_priority: Array<{ rank: number; target: string; exploit: string; reason: string }>
  recommended_workflow: string[]
  rawSearchOutput?: string
}

const EMPTY_RESULT: VglobResult = {
  fingerprints_analyzed: [],
  matches: [],
  no_matches: [],
  attack_priority: [],
  recommended_workflow: [],
}

/**
 * Extract software names/versions for searchsploit queries
 */
function extractSearchTerms(fingerprints: Array<{ banner: string }>): string[] {
  const terms: string[] = []

  for (const fp of fingerprints) {
    // Extract key terms from banner
    // "Apache/2.4.49 (Ubuntu)" -> "apache 2.4.49"
    // "OpenSSH 7.2p2 Ubuntu" -> "openssh 7.2"
    const cleaned = fp.banner
      .toLowerCase()
      .replace(/[()]/g, ' ')
      .replace(/[/_-]/g, ' ')
      .trim()

    // Extract name and version
    const versionMatch = cleaned.match(/(\w+)\s*([\d.]+)/)
    if (versionMatch) {
      terms.push(`${versionMatch[1]} ${versionMatch[2]}`)
    } else {
      // Just use first word
      const firstWord = cleaned.split(/\s+/)[0]
      if (firstWord && firstWord.length > 2) {
        terms.push(firstWord)
      }
    }
  }

  return [...new Set(terms)] // Dedupe
}

/**
 * Run searchsploit for each term
 */
async function searchExploits(terms: string[]): Promise<string> {
  const results: string[] = []

  // Limit concurrent searches
  for (const term of terms.slice(0, 5)) {
    const result = await executeProcess('searchsploit', [
      '-w', // Show full path URLs
      '--exclude=dos', // Skip DoS exploits
      term,
    ], {
      timeoutMs: 10000,
      toolName: 'searchsploit',
    })

    if (result.success && result.output && !result.output.includes('No Results')) {
      results.push(`=== ${term} ===\n${result.output}`)
    }
  }

  return results.join('\n\n')
}

export const vglobAgent = defineAgent<typeof vglobParams, VglobResult>({
  name: 'vglob',
  description: 'Pattern match service fingerprints to exploits. Like glob but for vulnerabilities - finds CVEs, Metasploit modules, attack chains.',
  systemPrompt: EXPLOIT_MATCHER_SYSTEM_PROMPT,
  parameters: vglobParams,

  async execute(params: VglobParams, context): Promise<AgentResult<VglobResult>> {
    // Extract search terms from fingerprints
    const searchTerms = extractSearchTerms(params.fingerprints)

    // Run searchsploit
    const searchOutput = await searchExploits(searchTerms)

    // Build prompt
    let userPrompt = 'Service fingerprints to analyze:\n\n'

    for (const fp of params.fingerprints) {
      userPrompt += `- "${fp.banner}"`
      if (fp.port) userPrompt += ` (port ${fp.port})`
      if (fp.protocol) userPrompt += ` [${fp.protocol}]`
      userPrompt += '\n'
    }

    if (params.prioritize !== 'any') {
      userPrompt += `\nPrioritize: ${params.prioritize} exploits\n`
    }

    if (params.includeMetasploit) {
      userPrompt += '\nInclude Metasploit module recommendations.\n'
    }

    if (searchOutput) {
      userPrompt += `\n=== SEARCHSPLOIT RESULTS ===\n${searchOutput}\n`
    }

    userPrompt += '\nMatch these fingerprints to known exploits and build attack chains.'

    // Run LLM analysis
    const result = await executeAgentLLM({
      name: 'vglob',
      systemPrompt: EXPLOIT_MATCHER_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Exploit matching failed',
        data: { ...EMPTY_RESULT, rawSearchOutput: searchOutput },
      }
    }

    try {
      const parsed = JSON.parse(result.text) as VglobResult
      parsed.rawSearchOutput = searchOutput

      // Build summary
      const matchCount = parsed.matches.length
      const criticalCount = parsed.matches.filter(m => m.severity === 'critical').length
      const topMatch = parsed.attack_priority[0]

      const summaryParts = [
        `${matchCount} exploit matches`,
        criticalCount > 0 ? `(${criticalCount} critical)` : '',
        topMatch ? `Top: ${topMatch.exploit}` : '',
      ].filter(Boolean)

      return {
        success: true,
        summary: summaryParts.join(', '),
        data: parsed,
      }
    } catch {
      return {
        success: true,
        summary: 'Exploit matching complete (parse failed)',
        data: { ...EMPTY_RESULT, rawSearchOutput: searchOutput },
      }
    }
  },
})
