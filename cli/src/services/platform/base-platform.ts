/**
 * Base Platform Adapter
 *
 * Abstract base class for platform clients (HTB, THM).
 * Implements common OAuth, request handling, and VPN logic.
 */

import type { Machine, SpawnResult, FlagResult } from '../../types/platform'
import type { IPlatform, PlatformCredentials, PlatformUser, VPNConfig, MachineFilters } from './types'
import { writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const REDIRECT_URI = 'http://localhost:31337/callback'

/**
 * Platform-specific configuration
 */
export interface PlatformConfig {
  name: 'htb' | 'thm'
  displayName: string
  apiBase: string
  authUrl: string
  tokenUrl: string
  clientId: string
  scopes: string
}

/**
 * Abstract base class for platform adapters
 * Subclasses implement platform-specific API mappings
 */
export abstract class BasePlatformClient implements IPlatform {
  protected credentials: PlatformCredentials | null = null
  protected user: PlatformUser | null = null
  protected abstract readonly config: PlatformConfig

  get name(): 'htb' | 'thm' {
    return this.config.name
  }

  get displayName(): string {
    return this.config.displayName
  }

  // ─── Auth (shared) ─────────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    if (!this.credentials?.accessToken) return false
    if (this.credentials.expiresAt && this.credentials.expiresAt < new Date()) {
      return false
    }
    return true
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: this.config.scopes,
    })
    return `${this.config.authUrl}?${params.toString()}`
  }

  async handleOAuthCallback(code: string): Promise<PlatformCredentials> {
    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    })

    if (!res.ok) {
      throw new Error(`${this.config.displayName} OAuth failed: ${res.status}`)
    }

    const data = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    this.credentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }

    return this.credentials
  }

  setCredentials(creds: PlatformCredentials): void {
    this.credentials = creds
  }

  getCredentials(): PlatformCredentials | null {
    return this.credentials
  }

  logout(): void {
    this.credentials = null
    this.user = null
  }

  // ─── API Request (shared) ──────────────────────────────────────────────────

  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.credentials?.accessToken) {
      throw new Error(`Not authenticated with ${this.config.displayName}`)
    }

    const res = await fetch(`${this.config.apiBase}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`${this.config.displayName} API error ${res.status}: ${error}`)
    }

    return (await res.json()) as T
  }

  // ─── VPN (shared with platform-specific paths) ─────────────────────────────

  protected get vpnPath(): string {
    return join(homedir(), '.sonder', 'vpn', `${this.config.name}.ovpn`)
  }

  protected async saveVPNConfig(config: string): Promise<string> {
    const vpnDir = join(homedir(), '.sonder', 'vpn')
    await mkdir(vpnDir, { recursive: true })
    await writeFile(this.vpnPath, config)
    return this.vpnPath
  }

  // ─── Abstract methods (platform-specific) ──────────────────────────────────

  abstract getCurrentUser(): Promise<PlatformUser>
  abstract downloadVPNConfig(): Promise<string>
  abstract getVPNStatus(): Promise<VPNConfig | null>
  abstract listMachines(filters?: MachineFilters): Promise<Machine[]>
  abstract getMachine(id: string): Promise<Machine | null>
  abstract spawnMachine(id: string): Promise<SpawnResult>
  abstract stopMachine(id: string): Promise<{ success: boolean; error?: string }>
  abstract extendMachine(id: string): Promise<{ success: boolean; newExpiresAt?: Date }>
  abstract submitFlag(machineId: string, flag: string): Promise<FlagResult>
  abstract getActiveMachine(): Promise<Machine | null>
}
