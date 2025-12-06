/**
 * TryHackMe API client
 * Implements IPlatform interface for THM
 *
 * THM uses a JWT-based auth system
 */

import type { Machine, SpawnResult, FlagResult, Difficulty } from '../../types/platform'
import type { IPlatform, PlatformCredentials, PlatformUser, VPNConfig, MachineFilters } from './types'
import { writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const THM_API_BASE = 'https://tryhackme.com/api/v2'
const THM_AUTH_URL = 'https://tryhackme.com/oauth/authorize'
const THM_TOKEN_URL = 'https://tryhackme.com/oauth/token'

const CLIENT_ID = process.env.THM_CLIENT_ID || 'sonder-cli'
const REDIRECT_URI = 'http://localhost:31337/callback'

export class TryHackMeClient implements IPlatform {
  readonly name = 'thm' as const
  readonly displayName = 'TryHackMe'

  private credentials: PlatformCredentials | null = null
  private user: PlatformUser | null = null

  // ─── Auth ────────────────────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    if (!this.credentials?.accessToken) return false
    if (this.credentials.expiresAt && this.credentials.expiresAt < new Date()) {
      return false
    }
    return true
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'user:read rooms:read rooms:write vpn:read',
    })
    return `${THM_AUTH_URL}?${params.toString()}`
  }

  async handleOAuthCallback(code: string): Promise<PlatformCredentials> {
    const res = await fetch(THM_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    })

    if (!res.ok) {
      throw new Error(`THM OAuth failed: ${res.status}`)
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

  // ─── API Helpers ─────────────────────────────────────────────────────────────

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.credentials?.accessToken) {
      throw new Error('Not authenticated with TryHackMe')
    }

    const res = await fetch(`${THM_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`THM API error ${res.status}: ${error}`)
    }

    return (await res.json()) as T
  }

  // ─── User ────────────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<PlatformUser> {
    if (this.user) return this.user

    const data = await this.request<{
      data: {
        id: string
        username: string
        email: string
        avatar: string
        rank: string
        points: number
      }
    }>('/user/me')

    this.user = {
      id: data.data.id,
      username: data.data.username,
      email: data.data.email,
      avatar: data.data.avatar,
      rank: data.data.rank,
      points: data.data.points,
    }

    return this.user
  }

  // ─── VPN ─────────────────────────────────────────────────────────────────────

  async downloadVPNConfig(): Promise<string> {
    const data = await this.request<{ data: { config: string } }>('/vpn/config')

    const vpnDir = join(homedir(), '.sonder', 'vpn')
    await mkdir(vpnDir, { recursive: true })
    const ovpnPath = join(vpnDir, 'thm.ovpn')
    await writeFile(ovpnPath, data.data.config)

    return ovpnPath
  }

  async getVPNStatus(): Promise<VPNConfig | null> {
    try {
      const data = await this.request<{
        data: {
          connected: boolean
          server: string
          ip: string
        }
      }>('/vpn/status')

      if (!data.data.connected) return null

      return {
        ovpnPath: join(homedir(), '.sonder', 'vpn', 'thm.ovpn'),
        server: data.data.server,
        isConnected: true,
      }
    } catch {
      return null
    }
  }

  // ─── Machines (THM calls them "rooms") ───────────────────────────────────────

  async listMachines(filters?: MachineFilters): Promise<Machine[]> {
    const params = new URLSearchParams()
    if (filters?.difficulty) params.set('difficulty', filters.difficulty)
    if (filters?.search) params.set('search', filters.search)

    const queryString = params.toString()
    const endpoint = `/rooms${queryString ? `?${queryString}` : ''}`

    const data = await this.request<{
      data: Array<{
        code: string
        title: string
        description: string
        difficulty: 'easy' | 'medium' | 'hard' | 'insane'
        type: string
        userCompleted: boolean
        published: string
        tags: string[]
      }>
    }>(endpoint)

    let machines = data.data.map((r) => this.mapRoom(r))

    if (filters?.os) {
      // THM doesn't expose OS easily, skip filter
    }
    if (filters?.owned !== undefined) {
      machines = machines.filter((m) => m.userOwned === filters.owned)
    }

    return machines
  }

  async getMachine(id: string): Promise<Machine | null> {
    const roomCode = id.replace('thm-', '')

    try {
      const data = await this.request<{
        data: {
          code: string
          title: string
          description: string
          difficulty: 'easy' | 'medium' | 'hard' | 'insane'
          type: string
          userCompleted: boolean
          published: string
          tags: string[]
          ip?: string
        }
      }>(`/rooms/${roomCode}`)

      return this.mapRoom(data.data)
    } catch {
      return null
    }
  }

  private mapRoom(r: {
    code: string
    title: string
    description?: string
    difficulty: 'easy' | 'medium' | 'hard' | 'insane'
    type?: string
    userCompleted?: boolean
    published: string
    tags?: string[]
    ip?: string
  }): Machine {
    return {
      id: `thm-${r.code}`,
      name: r.title,
      platform: 'thm',
      difficulty: r.difficulty as Difficulty,
      os: 'linux', // THM doesn't always specify, default to linux
      ip: r.ip,
      status: r.ip ? 'running' : 'offline',
      userOwned: r.userCompleted || false,
      rootOwned: r.userCompleted || false, // THM doesn't distinguish
      releaseDate: new Date(r.published),
      tags: r.tags || [],
    }
  }

  async spawnMachine(id: string): Promise<SpawnResult> {
    const roomCode = id.replace('thm-', '')

    try {
      const data = await this.request<{
        success: boolean
        data?: {
          ip: string
          expires: string
        }
        error?: string
      }>(`/rooms/${roomCode}/deploy`, {
        method: 'POST',
      })

      if (data.success && data.data) {
        return {
          success: true,
          machineId: id,
          ip: data.data.ip,
          expiresAt: new Date(data.data.expires),
        }
      }

      return {
        success: false,
        machineId: id,
        error: data.error || 'Failed to deploy room',
      }
    } catch (err) {
      return {
        success: false,
        machineId: id,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  async stopMachine(id: string): Promise<{ success: boolean; error?: string }> {
    const roomCode = id.replace('thm-', '')

    try {
      await this.request(`/rooms/${roomCode}/terminate`, {
        method: 'POST',
      })
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  async extendMachine(id: string): Promise<{ success: boolean; newExpiresAt?: Date }> {
    const roomCode = id.replace('thm-', '')

    try {
      const data = await this.request<{
        success: boolean
        data?: { expires: string }
      }>(`/rooms/${roomCode}/extend`, {
        method: 'POST',
      })

      if (data.success && data.data) {
        return {
          success: true,
          newExpiresAt: new Date(data.data.expires),
        }
      }
      return { success: false }
    } catch {
      return { success: false }
    }
  }

  // ─── Flags ───────────────────────────────────────────────────────────────────

  async submitFlag(machineId: string, flag: string): Promise<FlagResult> {
    const roomCode = machineId.replace('thm-', '')

    try {
      const data = await this.request<{
        success: boolean
        correct: boolean
        message: string
      }>(`/rooms/${roomCode}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer: flag }),
      })

      return {
        success: true,
        correct: data.correct,
        flagType: data.correct ? 'user' : undefined,
        message: data.message,
      }
    } catch (err) {
      return {
        success: false,
        correct: false,
        message: err instanceof Error ? err.message : 'Failed to submit flag',
      }
    }
  }

  // ─── Active Machine ──────────────────────────────────────────────────────────

  async getActiveMachine(): Promise<Machine | null> {
    try {
      const data = await this.request<{
        data: {
          code: string
          title: string
          difficulty: 'easy' | 'medium' | 'hard' | 'insane'
          published: string
          ip: string
        } | null
      }>('/rooms/active')

      if (!data.data) return null

      return this.mapRoom(data.data)
    } catch {
      return null
    }
  }
}

export const thmClient = new TryHackMeClient()
