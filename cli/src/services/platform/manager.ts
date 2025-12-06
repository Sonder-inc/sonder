/**
 * Platform Manager
 * Unified interface for interacting with HTB/THM
 * Handles OAuth flow, credential storage, and platform switching
 */

import { createServer, type Server } from 'http'
import { parse } from 'url'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'

import type { IPlatform, PlatformCredentials, OAuthState } from './types'
import type { Machine, SpawnResult, FlagResult } from '../../types/platform'
import { htbClient } from './htb'
import { thmClient } from './thm'

const CREDENTIALS_PATH = join(homedir(), '.sonder', 'credentials.json')
const OAUTH_PORT = 31337

interface StoredPlatformCredentials {
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: string // ISO string for storage
}

interface StoredCredentials {
  htb?: StoredPlatformCredentials
  thm?: StoredPlatformCredentials
}

export class PlatformManager {
  private platforms: Map<'htb' | 'thm', IPlatform> = new Map<'htb' | 'thm', IPlatform>([
    ['htb', htbClient],
    ['thm', thmClient],
  ])

  private activePlatform: 'htb' | 'thm' | null = null
  private oauthServer: Server | null = null
  private vpnProcess: ChildProcess | null = null

  // ─── Initialization ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    await this.loadCredentials()
  }

  private async loadCredentials(): Promise<void> {
    try {
      const data = await readFile(CREDENTIALS_PATH, 'utf-8')
      const stored: StoredCredentials = JSON.parse(data)

      if (stored.htb) {
        const { expiresAt, ...rest } = stored.htb
        htbClient.setCredentials({
          ...rest,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        })
      }

      if (stored.thm) {
        const { expiresAt, ...rest } = stored.thm
        thmClient.setCredentials({
          ...rest,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        })
      }
    } catch {
      // No credentials file, that's fine
    }
  }

  private async saveCredentials(): Promise<void> {
    const stored: StoredCredentials = {}

    const htbCreds = htbClient.getCredentials()
    if (htbCreds) {
      stored.htb = {
        apiKey: htbCreds.apiKey,
        accessToken: htbCreds.accessToken,
        refreshToken: htbCreds.refreshToken,
        expiresAt: htbCreds.expiresAt?.toISOString(),
      }
    }

    const thmCreds = thmClient.getCredentials()
    if (thmCreds) {
      stored.thm = {
        apiKey: thmCreds.apiKey,
        accessToken: thmCreds.accessToken,
        refreshToken: thmCreds.refreshToken,
        expiresAt: thmCreds.expiresAt?.toISOString(),
      }
    }

    await mkdir(join(homedir(), '.sonder'), { recursive: true })
    await writeFile(CREDENTIALS_PATH, JSON.stringify(stored, null, 2))
  }

  // ─── Platform Access ─────────────────────────────────────────────────────────

  getPlatform(name: 'htb' | 'thm'): IPlatform {
    const platform = this.platforms.get(name)
    if (!platform) throw new Error(`Unknown platform: ${name}`)
    return platform
  }

  getActivePlatform(): IPlatform | null {
    if (!this.activePlatform) return null
    return this.platforms.get(this.activePlatform) || null
  }

  setActivePlatform(name: 'htb' | 'thm'): void {
    this.activePlatform = name
  }

  isAuthenticated(platform?: 'htb' | 'thm'): boolean {
    if (platform) {
      return this.getPlatform(platform).isAuthenticated()
    }
    // Check if either is authenticated
    return htbClient.isAuthenticated() || thmClient.isAuthenticated()
  }

  getAuthenticatedPlatforms(): ('htb' | 'thm')[] {
    const result: ('htb' | 'thm')[] = []
    if (htbClient.isAuthenticated()) result.push('htb')
    if (thmClient.isAuthenticated()) result.push('thm')
    return result
  }

  // ─── OAuth Flow ──────────────────────────────────────────────────────────────

  /**
   * Start OAuth flow for a platform
   * Opens browser and starts local server for callback
   */
  async authenticate(platform: 'htb' | 'thm'): Promise<{ success: boolean; error?: string }> {
    const client = this.getPlatform(platform)
    const authUrl = client.getAuthUrl()

    return new Promise((resolve) => {
      // Start callback server
      this.oauthServer = createServer(async (req, res) => {
        const { pathname, query } = parse(req.url || '', true)

        if (pathname === '/callback') {
          const code = query.code as string
          const error = query.error as string

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end('<html><body><h1>Authentication failed</h1><p>You can close this window.</p></body></html>')
            this.stopOAuthServer()
            resolve({ success: false, error })
            return
          }

          if (code) {
            try {
              await client.handleOAuthCallback(code)
              await this.saveCredentials()

              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(`
                <html>
                  <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #fff;">
                    <div style="text-align: center;">
                      <h1 style="color: #00d9ff;">✓ Connected to ${client.displayName}</h1>
                      <p>You can close this window and return to sonder.</p>
                    </div>
                  </body>
                </html>
              `)
              this.stopOAuthServer()
              resolve({ success: true })
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'text/html' })
              res.end('<html><body><h1>Authentication error</h1></body></html>')
              this.stopOAuthServer()
              resolve({
                success: false,
                error: err instanceof Error ? err.message : 'Unknown error',
              })
            }
            return
          }
        }

        res.writeHead(404)
        res.end()
      })

      this.oauthServer.listen(OAUTH_PORT, () => {
        // Open browser
        const openCmd =
          process.platform === 'darwin'
            ? 'open'
            : process.platform === 'win32'
              ? 'start'
              : 'xdg-open'

        spawn(openCmd, [authUrl], { detached: true, stdio: 'ignore' }).unref()
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.oauthServer) {
          this.stopOAuthServer()
          resolve({ success: false, error: 'Authentication timeout' })
        }
      }, 5 * 60 * 1000)
    })
  }

  private stopOAuthServer(): void {
    if (this.oauthServer) {
      this.oauthServer.close()
      this.oauthServer = null
    }
  }

  async logout(platform: 'htb' | 'thm'): Promise<void> {
    this.getPlatform(platform).logout()
    await this.saveCredentials()
    if (this.activePlatform === platform) {
      this.activePlatform = null
    }
  }

  // ─── VPN Management ──────────────────────────────────────────────────────────

  async connectVPN(platform: 'htb' | 'thm'): Promise<{ success: boolean; error?: string }> {
    const client = this.getPlatform(platform)

    if (!client.isAuthenticated()) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Check if already connected
      const status = await client.getVPNStatus()
      if (status?.isConnected) {
        return { success: true }
      }

      // Download VPN config
      const ovpnPath = await client.downloadVPNConfig()

      // Connect using openvpn
      // Requires sudo, which might prompt for password
      this.vpnProcess = spawn('sudo', ['openvpn', '--config', ovpnPath], {
        detached: true,
        stdio: 'pipe',
      })

      // Wait for connection (look for "Initialization Sequence Completed")
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'VPN connection timeout' })
        }, 30000)

        this.vpnProcess?.stdout?.on('data', (data: Buffer) => {
          if (data.toString().includes('Initialization Sequence Completed')) {
            clearTimeout(timeout)
            resolve({ success: true })
          }
        })

        this.vpnProcess?.stderr?.on('data', (data: Buffer) => {
          const msg = data.toString()
          if (msg.includes('error') || msg.includes('failed')) {
            clearTimeout(timeout)
            resolve({ success: false, error: msg })
          }
        })

        this.vpnProcess?.on('error', (err) => {
          clearTimeout(timeout)
          resolve({ success: false, error: err.message })
        })
      })
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'VPN connection failed',
      }
    }
  }

  async disconnectVPN(): Promise<void> {
    if (this.vpnProcess) {
      this.vpnProcess.kill('SIGTERM')
      this.vpnProcess = null
    }

    // Also try to kill any openvpn processes we might have spawned
    try {
      spawn('sudo', ['killall', 'openvpn'], { stdio: 'ignore' })
    } catch {
      // Ignore errors
    }
  }

  async getVPNStatus(platform: 'htb' | 'thm'): Promise<{ connected: boolean; server?: string }> {
    const client = this.getPlatform(platform)
    const status = await client.getVPNStatus()
    return {
      connected: status?.isConnected || false,
      server: status?.server,
    }
  }

  // ─── Unified Machine Operations ──────────────────────────────────────────────

  /**
   * List machines from all authenticated platforms
   */
  async listAllMachines(): Promise<Machine[]> {
    const machines: Machine[] = []

    if (htbClient.isAuthenticated()) {
      const htbMachines = await htbClient.listMachines()
      machines.push(...htbMachines)
    }

    if (thmClient.isAuthenticated()) {
      const thmMachines = await thmClient.listMachines()
      machines.push(...thmMachines)
    }

    return machines
  }

  /**
   * Get machine by ID (auto-detects platform from ID prefix)
   */
  async getMachine(id: string): Promise<Machine | null> {
    if (id.startsWith('htb-')) {
      return htbClient.getMachine(id)
    }
    if (id.startsWith('thm-')) {
      return thmClient.getMachine(id)
    }
    return null
  }

  /**
   * Spawn machine (auto-detects platform)
   */
  async spawnMachine(id: string): Promise<SpawnResult> {
    const platform = id.startsWith('htb-') ? 'htb' : id.startsWith('thm-') ? 'thm' : null

    if (!platform) {
      return { success: false, machineId: id, error: 'Unknown platform' }
    }

    const client = this.getPlatform(platform)

    // Ensure VPN is connected
    const vpnStatus = await this.getVPNStatus(platform)
    if (!vpnStatus.connected) {
      const vpnResult = await this.connectVPN(platform)
      if (!vpnResult.success) {
        return { success: false, machineId: id, error: `VPN: ${vpnResult.error}` }
      }
    }

    return client.spawnMachine(id)
  }

  /**
   * Stop machine (auto-detects platform)
   */
  async stopMachine(id: string): Promise<{ success: boolean; error?: string }> {
    if (id.startsWith('htb-')) {
      return htbClient.stopMachine(id)
    }
    if (id.startsWith('thm-')) {
      return thmClient.stopMachine(id)
    }
    return { success: false, error: 'Unknown platform' }
  }

  /**
   * Submit flag (auto-detects platform)
   */
  async submitFlag(machineId: string, flag: string): Promise<FlagResult> {
    if (machineId.startsWith('htb-')) {
      return htbClient.submitFlag(machineId, flag)
    }
    if (machineId.startsWith('thm-')) {
      return thmClient.submitFlag(machineId, flag)
    }
    return { success: false, correct: false, message: 'Unknown platform' }
  }

  /**
   * Get currently active machine from any platform
   */
  async getActiveMachine(): Promise<Machine | null> {
    // Check HTB first
    if (htbClient.isAuthenticated()) {
      const machine = await htbClient.getActiveMachine()
      if (machine) {
        this.activePlatform = 'htb'
        return machine
      }
    }

    // Then THM
    if (thmClient.isAuthenticated()) {
      const machine = await thmClient.getActiveMachine()
      if (machine) {
        this.activePlatform = 'thm'
        return machine
      }
    }

    return null
  }
}

export const platformManager = new PlatformManager()
