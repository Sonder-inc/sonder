import { initUserConfig } from './user-config'
import { initToolRegistry } from '../tools/registry'
import { initSmartToolRegistry } from '../smart-tools/registry'
import { mcpManager } from '../services/mcp-manager'
import { mkdir, writeFile, exists } from 'fs/promises'
import { join } from 'path'

export interface InitResult {
  configPath: string
  configCreated: boolean
  tools: {
    loaded: number
    names: string[]
  }
  agents: {
    loaded: number
    names: string[]
  }
  mcps: {
    loaded: number
    names: string[]
  }
}

/**
 * Initialize Sonder - called at startup
 */
export async function initSonder(): Promise<InitResult> {
  // 1. Ensure ~/.sonder directory structure exists
  const { created, path } = initUserConfig()

  // 2. Load user smart tools into registry (must be before tools, smart tools are exposed as tools)
  const smartTools = await initSmartToolRegistry()

  // 3. Load user tools into registry (includes agent-as-tool adapters)
  const tools = await initToolRegistry()

  // 4. Initialize MCP manager
  const mcps = await mcpManager.init()

  return {
    configPath: path,
    configCreated: created,
    tools,
    agents: smartTools,
    mcps,
  }
}

/**
 * Get summary for display
 */
export function getInitSummary(result: InitResult): string {
  const parts: string[] = []

  if (result.configCreated) {
    parts.push(`Created config: ${result.configPath}`)
  }

  if (result.tools.loaded > 0) {
    parts.push(`Loaded ${result.tools.loaded} user tools: ${result.tools.names.join(', ')}`)
  }

  if (result.agents.loaded > 0) {
    parts.push(`Loaded ${result.agents.loaded} user agents: ${result.agents.names.join(', ')}`)
  }

  if (result.mcps.loaded > 0) {
    parts.push(`Loaded ${result.mcps.loaded} MCPs: ${result.mcps.names.join(', ')}`)
  }

  return parts.join('\n')
}

export interface InitProjectResult {
  sonderMdCreated: boolean
  sonderMdPath: string
  findingsFolderCreated: boolean
  findingsFolderPath: string
}

const SONDER_MD_TEMPLATE = `# sonder.md

This file provides context to the Sonder agent about this project.

## Project Information

**Target**: [Machine/CTF name]
**Platform**: [HTB/THM/Other]
**Difficulty**: [Easy/Medium/Hard]
**IP Address**: [Target IP]

## Objectives

- [ ] User flag
- [ ] Root flag

## Reconnaissance

### Initial Scan
- Ports:
- Services:

### Enumeration Notes
[Add reconnaissance findings here]

## Vulnerabilities

[Document discovered vulnerabilities]

## Exploitation

[Document exploitation steps]

## Privilege Escalation

[Document privilege escalation steps]

## Flags

**User Flag**:
**Root Flag**:

## Tools Used

-
-

## Notes

[Additional notes and observations]
`

/**
 * Initialize Sonder in current directory - creates sonder.md and /findings folder
 */
export async function initProjectDirectory(targetDir: string = process.cwd()): Promise<InitProjectResult> {
  const sonderMdPath = join(targetDir, 'sonder.md')
  const findingsFolderPath = join(targetDir, 'findings')

  // Check if sonder.md already exists
  const sonderMdExists = await exists(sonderMdPath)
  let sonderMdCreated = false

  if (!sonderMdExists) {
    await writeFile(sonderMdPath, SONDER_MD_TEMPLATE, 'utf-8')
    sonderMdCreated = true
  }

  // Check if findings folder already exists
  const findingsFolderExists = await exists(findingsFolderPath)
  let findingsFolderCreated = false

  if (!findingsFolderExists) {
    await mkdir(findingsFolderPath, { recursive: true })
    findingsFolderCreated = true
  }

  return {
    sonderMdCreated,
    sonderMdPath,
    findingsFolderCreated,
    findingsFolderPath,
  }
}

/**
 * Get summary for project init display
 */
export function getInitProjectSummary(result: InitProjectResult): string {
  const parts: string[] = []

  if (result.sonderMdCreated) {
    parts.push(`Created ${result.sonderMdPath}`)
  } else {
    parts.push(`${result.sonderMdPath} already exists`)
  }

  if (result.findingsFolderCreated) {
    parts.push(`Created ${result.findingsFolderPath}/`)
  } else {
    parts.push(`${result.findingsFolderPath}/ already exists`)
  }

  return parts.join('\n')
}
