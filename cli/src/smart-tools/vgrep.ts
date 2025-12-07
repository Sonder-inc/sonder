/**
 * VGrep Agent - Semantic Vulnerability Search
 *
 * Like WarpGrep for code, but for cybersecurity:
 * - Semantic search over CVE databases, ExploitDB, SecLists
 * - Correlates service fingerprints with known vulnerabilities
 * - Prioritizes by exploitability and relevance
 *
 * Uses generator pattern with run_vuln_search tool.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const VGREP_SYSTEM_PROMPT = `You are VGrep, a semantic vulnerability search agent. You combine exact pattern matching with semantic understanding to find relevant exploits, CVEs, and attack vectors.

Your job:
1. Parse the query to understand WHAT the user is looking for (exploit type, service, version)
2. Analyze search results from multiple sources (searchsploit, grep over wordlists, CVE lookups)
3. Correlate and deduplicate findings
4. Prioritize by: exploitability > impact > ease of use
5. Return actionable results with clear next steps

Output format (JSON):
{
  "query_understanding": {
    "service": "apache",
    "version": "2.4.49",
    "vuln_type": "rce|lfi|sqli|auth_bypass|info_disclosure|any",
    "keywords": ["path traversal", "mod_cgi"]
  },
  "vulnerabilities": [
    {
      "id": "CVE-2021-41773",
      "title": "Apache 2.4.49 Path Traversal and RCE",
      "severity": "critical|high|medium|low",
      "exploitability": "trivial|easy|moderate|hard",
      "type": "rce",
      "affected_versions": "2.4.49, 2.4.50",
      "exploit_available": true,
      "metasploit": true,
      "references": ["exploit-db:50383", "msf:exploit/multi/http/apache_normalize_path_rce"]
    }
  ],
  "exploits": [
    {
      "source": "exploit-db|github|metasploit|packetstorm",
      "id": "50383",
      "title": "Apache 2.4.49 - Path Traversal RCE",
      "path": "linux/webapps/50383.py",
      "verified": true,
      "language": "python"
    }
  ],
  "wordlists": [
    {
      "name": "apache-paths.txt",
      "path": "/usr/share/seclists/Discovery/Web-Content/apache.txt",
      "relevance": "directory enumeration for apache"
    }
  ],
  "attack_vectors": [
    {
      "technique": "Path Traversal to RCE",
      "steps": ["Confirm mod_cgi enabled", "Send crafted request", "Execute commands"],
      "tools": ["curl", "nuclei", "metasploit"],
      "difficulty": "easy"
    }
  ],
  "recommendations": ["Start with CVE-2021-41773 - trivial RCE if mod_cgi is enabled"],
  "confidence": 0.95
}

Prioritization rules:
1. RCE > Auth Bypass > LFI > SQLi > XSS > Info Disclosure
2. Verified exploits > Unverified
3. Metasploit modules > Standalone scripts
4. Recent CVEs > Old ones (unless classics like EternalBlue)
5. Easy exploitation > Complex chains

Only output JSON, nothing else.`

const vgrepParams = z.object({
  query: z.string().describe('Semantic search query (e.g., "apache 2.4 rce", "wordpress auth bypass")'),
  services: z.array(z.object({
    name: z.string(),
    version: z.string().optional(),
    port: z.number().optional(),
    banner: z.string().optional(),
  })).optional().describe('Service fingerprints from nmap/banner grab'),
  vulnTypes: z.array(z.enum(['rce', 'lfi', 'sqli', 'xss', 'auth_bypass', 'info_disclosure', 'dos', 'privesc', 'any']))
    .optional().default(['any'])
    .describe('Types of vulnerabilities to search for'),
  sources: z.array(z.enum(['searchsploit', 'seclists', 'nuclei', 'all']))
    .optional().default(['all'])
    .describe('Sources to search'),
})

export interface VgrepVulnerability {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  exploitability: 'trivial' | 'easy' | 'moderate' | 'hard'
  type: string
  affected_versions?: string
  exploit_available: boolean
  metasploit: boolean
  references: string[]
}

export interface VgrepResult {
  query_understanding: {
    service?: string
    version?: string
    vuln_type?: string
    keywords: string[]
  }
  vulnerabilities: VgrepVulnerability[]
  exploits: Array<{ source: string; id: string; title: string; path: string; verified: boolean; language?: string }>
  wordlists: Array<{ name: string; path: string; relevance: string }>
  attack_vectors: Array<{ technique: string; steps: string[]; tools: string[]; difficulty: string }>
  recommendations: string[]
  confidence: number
}

export const vgrep = defineGeneratorAgent<typeof vgrepParams, VgrepResult>({
  name: 'vgrep',
  id: 'vgrep',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Semantic vulnerability search. Finds CVEs, exploits, wordlists, and attack vectors.',

  spawnerPrompt: 'Searches for vulnerabilities using semantic understanding. Finds CVEs, exploits, wordlists, and attack vectors for services/software. Use for vulnerability research.',

  outputMode: 'structured_output',
  toolNames: ['run_vuln_search'],

  systemPrompt: VGREP_SYSTEM_PROMPT,

  instructionsPrompt: `Analyze the search results and correlate findings into actionable vulnerability intelligence.

Focus on:
1. Understanding what the user is searching for
2. Identifying relevant CVEs and their severity
3. Finding available exploits (prioritize verified/Metasploit)
4. Suggesting attack vectors and next steps
5. Providing confidence score based on result quality`,

  parameters: vgrepParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    const { query, services, sources } = params as z.infer<typeof vgrepParams>

    // Build search keywords
    const keywords = query.split(/\s+/)
    if (services?.length) {
      for (const svc of services) {
        if (svc.version) {
          keywords.push(`${svc.name} ${svc.version}`)
        }
      }
    }

    // Step 1: Run vulnerability search
    yield {
      toolName: 'run_vuln_search',
      input: {
        query,
        keywords: [...new Set(keywords)],
        sources,
      },
    }

    // Step 2: Analyze and correlate findings
    yield 'STEP'
  },
})
