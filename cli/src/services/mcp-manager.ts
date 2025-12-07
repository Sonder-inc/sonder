import { spawn, type ChildProcess } from 'child_process'
import { loadConfig, type MCPServerConfig } from '../utils/user-config'
import { loadUserMCPs } from '../utils/user-loader'
import type {
  MCPInitializeResult,
  MCPToolDefinition,
  MCPToolCallResult,
  MCPToolsListResult,
  PendingRequest,
  AvailableMCPTool,
} from './mcp-types'

interface MCPConnection {
  name: string
  config: MCPServerConfig
  process: ChildProcess | null
  status: 'stopped' | 'starting' | 'running' | 'error'
  error?: string
  // MCP protocol state
  serverInfo?: MCPInitializeResult
  tools?: MCPToolDefinition[]
  // Request handling
  responseBuffer: string
  pendingRequests: Map<number, PendingRequest>
  requestId: number
}

const REQUEST_TIMEOUT_MS = 30000
const PROTOCOL_VERSION = '2024-11-05'

/**
 * MCP (Model Context Protocol) server manager
 * Handles spawning, connecting to, and managing MCP servers
 */
class MCPManager {
  private connections: Map<string, MCPConnection> = new Map()
  private initialized = false

  /**
   * Initialize MCP manager, loading configs from ~/.sonder/mcps/ and config.json
   */
  async init(): Promise<{ loaded: number; names: string[] }> {
    if (this.initialized) {
      return { loaded: 0, names: [] }
    }

    // Load MCPs from individual files
    const fileMCPs = loadUserMCPs()

    // Load MCPs from config.json
    const config = loadConfig()
    const configMCPs = config.mcpServers || {}

    // Merge (config.json takes precedence)
    const allMCPs = new Map<string, MCPServerConfig>(fileMCPs)
    for (const [name, mcpConfig] of Object.entries(configMCPs)) {
      allMCPs.set(name, mcpConfig)
    }

    // Create connection entries
    for (const [name, mcpConfig] of allMCPs.entries()) {
      this.connections.set(name, {
        name,
        config: mcpConfig,
        process: null,
        status: 'stopped',
        responseBuffer: '',
        pendingRequests: new Map(),
        requestId: 0,
      })
    }

    this.initialized = true

    // Auto-start enabled MCPs
    const enabledMCPs = Array.from(allMCPs.entries()).filter(
      ([_, cfg]) => cfg.enabled !== false
    )
    for (const [name] of enabledMCPs) {
      await this.start(name)
    }

    return {
      loaded: allMCPs.size,
      names: Array.from(allMCPs.keys()),
    }
  }

  /**
   * Start an MCP server and initialize the protocol
   */
  async start(name: string): Promise<boolean> {
    const conn = this.connections.get(name)
    if (!conn) {
      return false
    }

    if (conn.status === 'running') {
      return true
    }

    conn.status = 'starting'
    conn.responseBuffer = ''
    conn.pendingRequests.clear()
    conn.requestId = 0

    try {
      const proc = spawn(conn.config.command, conn.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...conn.config.env },
      })

      conn.process = proc

      // Set up persistent stdout handler for response buffering
      proc.stdout?.on('data', (data: Buffer) => {
        conn.responseBuffer += data.toString()
        this.processResponseBuffer(conn)
      })

      proc.stderr?.on('data', (data: Buffer) => {
        // Log stderr for debugging but don't treat as error
        const msg = data.toString().trim()
        if (msg) {
          console.error(`[MCP:${name}] ${msg}`)
        }
      })

      proc.on('error', err => {
        conn.status = 'error'
        conn.error = err.message
        this.rejectAllPending(conn, err.message)
      })

      proc.on('exit', code => {
        conn.status = 'stopped'
        conn.process = null
        conn.tools = undefined
        conn.serverInfo = undefined
        if (code !== 0) {
          conn.error = `Exited with code ${code}`
        }
        this.rejectAllPending(conn, 'MCP server exited')
      })

      // Initialize MCP protocol
      const initSuccess = await this.initialize(conn)
      if (!initSuccess) {
        conn.status = 'error'
        conn.error = 'Failed to initialize MCP protocol'
        proc.kill()
        return false
      }

      conn.status = 'running'
      return true
    } catch (err) {
      conn.status = 'error'
      conn.error = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  /**
   * Process buffered responses and resolve pending requests
   */
  private processResponseBuffer(conn: MCPConnection): void {
    const lines = conn.responseBuffer.split('\n')
    conn.responseBuffer = lines.pop() || '' // Keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        if (parsed.id !== undefined) {
          const pending = conn.pendingRequests.get(parsed.id)
          if (pending) {
            clearTimeout(pending.timeout)
            conn.pendingRequests.delete(parsed.id)
            if (parsed.error) {
              pending.reject(new Error(parsed.error.message || 'MCP error'))
            } else {
              pending.resolve(parsed.result)
            }
          }
        }
      } catch {
        // Ignore parse errors for incomplete/malformed lines
      }
    }
  }

  /**
   * Reject all pending requests (used on disconnect)
   */
  private rejectAllPending(conn: MCPConnection, reason: string): void {
    for (const [id, pending] of conn.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(reason))
    }
    conn.pendingRequests.clear()
  }

  /**
   * Initialize MCP protocol with server
   */
  private async initialize(conn: MCPConnection): Promise<boolean> {
    try {
      const result = (await this.request(conn.name, 'initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'sonder', version: '1.0.0' },
      })) as MCPInitializeResult

      conn.serverInfo = result

      // Send initialized notification
      this.notify(conn, 'notifications/initialized', {})

      // Discover tools if server supports them
      if (result.capabilities.tools) {
        await this.discoverTools(conn.name)
      }

      return true
    } catch (err) {
      conn.error = err instanceof Error ? err.message : 'Initialize failed'
      return false
    }
  }

  /**
   * Send a notification (no response expected)
   */
  private notify(
    conn: MCPConnection,
    method: string,
    params: Record<string, unknown>
  ): void {
    if (!conn.process?.stdin) return
    const notification = JSON.stringify({ jsonrpc: '2.0', method, params })
    conn.process.stdin.write(notification + '\n')
  }

  /**
   * Discover available tools from an MCP server
   * Automatically registers tools with the unified tool registry
   */
  async discoverTools(name: string): Promise<MCPToolDefinition[]> {
    const conn = this.connections.get(name)
    if (!conn) {
      throw new Error(`MCP ${name} not found`)
    }

    const result = (await this.request(name, 'tools/list', {})) as MCPToolsListResult
    conn.tools = result.tools || []

    // Register tools with unified registry
    const { toolRegistry } = await import('../tools/registry')
    toolRegistry.registerMCPTools(name, conn.tools)

    return conn.tools
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<MCPToolCallResult> {
    return (await this.request(serverName, 'tools/call', {
      name: toolName,
      arguments: args,
    })) as MCPToolCallResult
  }

  /**
   * Get all available tools from all running servers
   */
  getAvailableTools(): AvailableMCPTool[] {
    const tools: AvailableMCPTool[] = []
    for (const [name, conn] of this.connections) {
      if (conn.status === 'running' && conn.tools) {
        for (const tool of conn.tools) {
          tools.push({ server: name, tool })
        }
      }
    }
    return tools
  }

  /**
   * Stop an MCP server
   * Unregisters tools from the unified registry
   */
  async stop(name: string): Promise<boolean> {
    const conn = this.connections.get(name)
    if (!conn || !conn.process) {
      return false
    }

    // Unregister tools from unified registry
    const { toolRegistry } = await import('../tools/registry')
    toolRegistry.unregisterMCPTools(name)

    this.rejectAllPending(conn, 'MCP server stopped')
    conn.process.kill()
    conn.process = null
    conn.status = 'stopped'
    conn.tools = undefined
    conn.serverInfo = undefined
    return true
  }

  /**
   * Restart an MCP server
   */
  async restart(name: string): Promise<boolean> {
    await this.stop(name)
    return this.start(name)
  }

  /**
   * Get status of all MCPs
   */
  getStatus(): Array<{
    name: string
    status: MCPConnection['status']
    error?: string
    toolCount?: number
    serverInfo?: { name: string; version: string }
  }> {
    return Array.from(this.connections.values()).map(conn => ({
      name: conn.name,
      status: conn.status,
      error: conn.error,
      toolCount: conn.tools?.length,
      serverInfo: conn.serverInfo?.serverInfo,
    }))
  }

  /**
   * Get list of running MCP names
   */
  getRunning(): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.status === 'running')
      .map(([name]) => name)
  }

  /**
   * Shutdown all MCPs
   */
  async shutdown(): Promise<void> {
    for (const name of this.connections.keys()) {
      await this.stop(name)
    }
  }

  /**
   * Send a request to an MCP server (JSON-RPC over stdio)
   */
  async request(
    name: string,
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const conn = this.connections.get(name)
    if (!conn) {
      throw new Error(`MCP ${name} not found`)
    }
    if (!conn.process?.stdin) {
      throw new Error(`MCP ${name} is not running`)
    }

    return new Promise((resolve, reject) => {
      const id = ++conn.requestId
      const request = JSON.stringify({ jsonrpc: '2.0', id, method, params })

      const timeout = setTimeout(() => {
        conn.pendingRequests.delete(id)
        reject(new Error(`MCP request timeout: ${method}`))
      }, REQUEST_TIMEOUT_MS)

      conn.pendingRequests.set(id, { resolve, reject, timeout })
      conn.process!.stdin!.write(request + '\n')
    })
  }
}

// Singleton instance
export const mcpManager = new MCPManager()
