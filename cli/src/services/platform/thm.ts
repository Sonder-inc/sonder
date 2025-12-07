/**
 * TryHackMe API client
 * Extends BasePlatformClient with THM-specific API mappings
 */

import type { Machine, SpawnResult, FlagResult, Difficulty } from '../../types/platform'
import type { PlatformUser, VPNConfig, MachineFilters } from './types'
import { BasePlatformClient, type PlatformConfig } from './base-platform'

const THM_CONFIG: PlatformConfig = {
  name: 'thm',
  displayName: 'TryHackMe',
  apiBase: 'https://tryhackme.com/api/v2',
  authUrl: 'https://tryhackme.com/oauth/authorize',
  tokenUrl: 'https://tryhackme.com/oauth/token',
  clientId: process.env.THM_CLIENT_ID || 'sonder-cli',
  scopes: 'user:read rooms:read rooms:write vpn:read',
}

export class TryHackMeClient extends BasePlatformClient {
  protected readonly config = THM_CONFIG

  // ─── User ──────────────────────────────────────────────────────────────────

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

  // ─── VPN ───────────────────────────────────────────────────────────────────

  async downloadVPNConfig(): Promise<string> {
    const data = await this.request<{ data: { config: string } }>('/vpn/config')
    return this.saveVPNConfig(data.data.config)
  }

  async getVPNStatus(): Promise<VPNConfig | null> {
    try {
      const data = await this.request<{
        data: { connected: boolean; server: string; ip: string }
      }>('/vpn/status')

      if (!data.data.connected) return null

      return {
        ovpnPath: this.vpnPath,
        server: data.data.server,
        isConnected: true,
      }
    } catch {
      return null
    }
  }

  // ─── Machines (THM calls them "rooms") ─────────────────────────────────────

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
        difficulty: Difficulty
        type: string
        userCompleted: boolean
        published: string
        tags: string[]
      }>
    }>(endpoint)

    let machines = data.data.map((r) => this.mapRoom(r))

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
          difficulty: Difficulty
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
    difficulty: Difficulty
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
      difficulty: r.difficulty,
      os: 'linux', // THM doesn't always specify
      ip: r.ip,
      status: r.ip ? 'running' : 'offline',
      userOwned: r.userCompleted || false,
      rootOwned: r.userCompleted || false,
      releaseDate: new Date(r.published),
      tags: r.tags || [],
    }
  }

  async spawnMachine(id: string): Promise<SpawnResult> {
    const roomCode = id.replace('thm-', '')

    try {
      const data = await this.request<{
        success: boolean
        data?: { ip: string; expires: string }
        error?: string
      }>(`/rooms/${roomCode}/deploy`, { method: 'POST' })

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
      await this.request(`/rooms/${roomCode}/terminate`, { method: 'POST' })
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
      }>(`/rooms/${roomCode}/extend`, { method: 'POST' })

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

  // ─── Flags ─────────────────────────────────────────────────────────────────

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

  // ─── Active Machine ────────────────────────────────────────────────────────

  async getActiveMachine(): Promise<Machine | null> {
    try {
      const data = await this.request<{
        data: {
          code: string
          title: string
          difficulty: Difficulty
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
