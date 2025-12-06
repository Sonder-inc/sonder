import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from 'fs'

/**
 * User configuration directory structure
 * ~/.sonder/
 * ├── agents/     - User-defined agents (.ts files)
 * ├── tools/      - User-defined tools (.ts files)
 * ├── mcps/       - MCP server configurations (.json files)
 * └── config.json - Global config
 */

export const SONDER_HOME = process.env.SONDER_HOME || join(homedir(), '.sonder')

export const USER_DIRS = {
  root: SONDER_HOME,
  agents: join(SONDER_HOME, 'agents'),
  tools: join(SONDER_HOME, 'tools'),
  mcps: join(SONDER_HOME, 'mcps'),
  config: join(SONDER_HOME, 'config.json'),
} as const

/**
 * Default config structure
 */
export interface SonderConfig {
  defaultModel?: string
  theme?: 'dark' | 'light'
  autoUpdate?: boolean
  mcpServers?: Record<string, MCPServerConfig>
}

export interface MCPServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled?: boolean
}

/**
 * Example agent template for users
 */
const AGENT_TEMPLATE = `import { z } from 'zod'
import { defineAgent, type AgentResult } from '@sonder/cli/agents/types'
import { executeAgentLLM } from '@sonder/cli/services/agent-executor'

const myAgentParams = z.object({
  query: z.string().describe('The query to process'),
})

type MyAgentParams = z.infer<typeof myAgentParams>

export const myAgent = defineAgent<typeof myAgentParams, string>({
  name: 'my_agent',
  description: 'Description of what this agent does',
  systemPrompt: \`You are a helpful agent that...\`,
  parameters: myAgentParams,

  async execute(params: MyAgentParams, context): Promise<AgentResult<string>> {
    const result = await executeAgentLLM({
      name: 'my_agent',
      systemPrompt: this.systemPrompt,
      userPrompt: params.query,
      context,
    })

    return {
      success: result.success,
      summary: result.success ? 'Completed' : 'Failed',
      data: result.text,
    }
  },
})
`

/**
 * Example tool template for users
 */
const TOOL_TEMPLATE = `import { z } from 'zod'
import { defineTool, type ToolResult } from '@sonder/cli/tools/types'

export const myTool = defineTool({
  name: 'my_tool',
  description: 'Description of what this tool does',
  parameters: z.object({
    input: z.string().describe('Input parameter'),
  }),

  async execute({ input }): Promise<ToolResult> {
    // Your tool logic here
    return {
      success: true,
      summary: 'Tool completed',
      fullResult: \`Processed: \${input}\`,
    }
  },
})
`

/**
 * Example MCP config template
 */
const MCP_TEMPLATE = {
  name: 'example-mcp',
  description: 'Example MCP server configuration',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-example'],
  env: {},
  enabled: false,
}

/**
 * Initialize user config directories and create example files
 */
export function initUserConfig(): { created: boolean; path: string } {
  const alreadyExists = existsSync(USER_DIRS.root)

  // Create directories
  for (const dir of [USER_DIRS.root, USER_DIRS.agents, USER_DIRS.tools, USER_DIRS.mcps]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  // Create default config if not exists
  if (!existsSync(USER_DIRS.config)) {
    const defaultConfig: SonderConfig = {
      autoUpdate: true,
      mcpServers: {},
    }
    writeFileSync(USER_DIRS.config, JSON.stringify(defaultConfig, null, 2))
  }

  // Create example files if directories are empty
  const agentExample = join(USER_DIRS.agents, '_example-agent.ts')
  if (!existsSync(agentExample)) {
    writeFileSync(agentExample, AGENT_TEMPLATE)
  }

  const toolExample = join(USER_DIRS.tools, '_example-tool.ts')
  if (!existsSync(toolExample)) {
    writeFileSync(toolExample, TOOL_TEMPLATE)
  }

  const mcpExample = join(USER_DIRS.mcps, '_example-mcp.json')
  if (!existsSync(mcpExample)) {
    writeFileSync(mcpExample, JSON.stringify(MCP_TEMPLATE, null, 2))
  }

  return { created: !alreadyExists, path: USER_DIRS.root }
}

/**
 * Load user config
 */
export function loadConfig(): SonderConfig {
  if (!existsSync(USER_DIRS.config)) {
    return {}
  }
  try {
    return JSON.parse(readFileSync(USER_DIRS.config, 'utf-8')) as SonderConfig
  } catch {
    return {}
  }
}

/**
 * Save user config
 */
export function saveConfig(config: SonderConfig): void {
  mkdirSync(USER_DIRS.root, { recursive: true })
  writeFileSync(USER_DIRS.config, JSON.stringify(config, null, 2))
}

/**
 * List files in a user directory
 */
export function listUserFiles(
  type: 'agents' | 'tools' | 'mcps'
): Array<{ name: string; path: string; isExample: boolean }> {
  const dir = USER_DIRS[type]
  if (!existsSync(dir)) {
    return []
  }

  const ext = type === 'mcps' ? '.json' : '.ts'
  return readdirSync(dir)
    .filter(f => f.endsWith(ext))
    .map(f => ({
      name: f.replace(ext, ''),
      path: join(dir, f),
      isExample: f.startsWith('_'),
    }))
}

/**
 * Get info about the user config directory
 */
export function getUserConfigInfo(): {
  exists: boolean
  path: string
  agents: number
  tools: number
  mcps: number
} {
  const exists = existsSync(USER_DIRS.root)
  return {
    exists,
    path: USER_DIRS.root,
    agents: listUserFiles('agents').filter(f => !f.isExample).length,
    tools: listUserFiles('tools').filter(f => !f.isExample).length,
    mcps: listUserFiles('mcps').filter(f => !f.isExample).length,
  }
}
