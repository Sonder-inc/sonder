import { spawn, type ChildProcess } from 'child_process'
import { loadConfig, type MCPServerConfig } from '../utils/user-config'
import { loadUserMCPs } from '../utils/user-loader'

interface MCPConnection {
  name: string
  config: MCPServerConfig
  process: ChildProcess | null
  status: 'stopped' | 'starting' | 'running' | 'error'
  error?: string
}

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
   * Start an MCP server
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

    try {
      const proc = spawn(conn.config.command, conn.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...conn.config.env },
      })

      conn.process = proc
      conn.status = 'running'

      proc.on('error', err => {
        conn.status = 'error'
        conn.error = err.message
      })

      proc.on('exit', code => {
        conn.status = 'stopped'
        conn.process = null
        if (code !== 0) {
          conn.error = `Exited with code ${code}`
        }
      })

      return true
    } catch (err) {
      conn.status = 'error'
      conn.error = err instanceof Error ? err.message : 'Unknown error'
      return false
    }
  }

  /**
   * Stop an MCP server
   */
  async stop(name: string): Promise<boolean> {
    const conn = this.connections.get(name)
    if (!conn || !conn.process) {
      return false
    }

    conn.process.kill()
    conn.process = null
    conn.status = 'stopped'
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
  }> {
    return Array.from(this.connections.values()).map(conn => ({
      name: conn.name,
      status: conn.status,
      error: conn.error,
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
    if (!conn || conn.status !== 'running' || !conn.process) {
      throw new Error(`MCP ${name} is not running`)
    }

    return new Promise((resolve, reject) => {
      const id = Date.now()
      const request = JSON.stringify({ jsonrpc: '2.0', id, method, params })

      const proc = conn.process!
      let response = ''

      const onData = (data: Buffer) => {
        response += data.toString()
        try {
          const parsed = JSON.parse(response)
          proc.stdout?.off('data', onData)
          if (parsed.error) {
            reject(new Error(parsed.error.message))
          } else {
            resolve(parsed.result)
          }
        } catch {
          // Incomplete JSON, wait for more data
        }
      }

      proc.stdout?.on('data', onData)
      proc.stdin?.write(request + '\n')

      // Timeout after 30s
      setTimeout(() => {
        proc.stdout?.off('data', onData)
        reject(new Error('MCP request timeout'))
      }, 30000)
    })
  }
}

// Singleton instance
export const mcpManager = new MCPManager()
