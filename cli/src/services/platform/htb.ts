/**
 * HackTheBox API client
 * Extends BasePlatformClient with HTB-specific API mappings
 *
 * API Docs: https://documenter.getpostman.com/view/13129365/TVeqbmeq
 */

import type { Machine, SpawnResult, FlagResult, Difficulty } from '../../types/platform'
import type { PlatformUser, VPNConfig, MachineFilters } from './types'
import { BasePlatformClient, type PlatformConfig } from './base-platform'

const HTB_CONFIG: PlatformConfig = {
  name: 'htb',
  displayName: 'HackTheBox',
  apiBase: 'https://labs.hackthebox.com/api/v4',
  authUrl: 'https://app.hackthebox.com/oauth/authorize',
  tokenUrl: 'https://app.hackthebox.com/oauth/token',
  clientId: process.env.HTB_CLIENT_ID || 'sonder-cli',
  scopes: 'read write',
}

export class HackTheBoxClient extends BasePlatformClient {
  protected readonly config = HTB_CONFIG

  // ─── User ──────────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<PlatformUser> {
    if (this.user) return this.user

    const data = await this.request<{
      info: {
        id: number
        name: string
        email: string
        avatar: string
        rank: string
        points: number
      }
    }>('/user/info')

    this.user = {
      id: String(data.info.id),
      username: data.info.name,
      email: data.info.email,
      avatar: data.info.avatar,
      rank: data.info.rank,
      points: data.info.points,
    }

    return this.user
  }

  // ─── VPN ───────────────────────────────────────────────────────────────────

  async downloadVPNConfig(): Promise<string> {
    const data = await this.request<{ data: string }>('/access/ovpnfile')
    return this.saveVPNConfig(data.data)
  }

  async getVPNStatus(): Promise<VPNConfig | null> {
    try {
      const data = await this.request<{
        data: { connection: { ip: string; server: string } | null }
      }>('/access/status')

      if (!data.data.connection) return null

      return {
        ovpnPath: this.vpnPath,
        server: data.data.connection.server,
        isConnected: true,
      }
    } catch {
      return null
    }
  }

  // ─── Machines ──────────────────────────────────────────────────────────────

  async listMachines(filters?: MachineFilters): Promise<Machine[]> {
    const endpoint = filters?.retired ? '/machine/list/retired' : '/machine/list'

    const data = await this.request<{
      info: Array<{
        id: number
        name: string
        os: string
        difficulty: number
        user_owns_count: number
        root_owns_count: number
        authUserInUserOwns: boolean
        authUserInRootOwns: boolean
        release: string
        active: number
        ip: string | null
      }>
    }>(endpoint)

    let machines = data.info.map((m) => this.mapMachine(m))

    if (filters?.difficulty) {
      machines = machines.filter((m) => m.difficulty === filters.difficulty)
    }
    if (filters?.os) {
      machines = machines.filter((m) => m.os === filters.os)
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase()
      machines = machines.filter((m) => m.name.toLowerCase().includes(s))
    }
    if (filters?.owned !== undefined) {
      machines = machines.filter((m) => (m.userOwned || m.rootOwned) === filters.owned)
    }

    return machines
  }

  async getMachine(id: string): Promise<Machine | null> {
    try {
      const data = await this.request<{
        info: {
          id: number
          name: string
          os: string
          difficulty: number
          authUserInUserOwns: boolean
          authUserInRootOwns: boolean
          release: string
          active: number
          ip: string | null
        }
      }>(`/machine/profile/${id}`)

      return this.mapMachine(data.info)
    } catch {
      return null
    }
  }

  private mapMachine(m: {
    id: number
    name: string
    os: string
    difficulty: number
    authUserInUserOwns?: boolean
    authUserInRootOwns?: boolean
    release: string
    active?: number
    ip?: string | null
  }): Machine {
    return {
      id: `htb-${m.id}`,
      name: m.name,
      platform: 'htb',
      difficulty: this.mapDifficulty(m.difficulty),
      os: m.os.toLowerCase() as 'linux' | 'windows',
      ip: m.ip || undefined,
      status: m.ip ? 'running' : 'offline',
      userOwned: m.authUserInUserOwns || false,
      rootOwned: m.authUserInRootOwns || false,
      releaseDate: new Date(m.release),
      tags: [],
    }
  }

  private mapDifficulty(score: number): Difficulty {
    if (score <= 20) return 'easy'
    if (score <= 40) return 'medium'
    if (score <= 70) return 'hard'
    return 'insane'
  }

  async spawnMachine(id: string): Promise<SpawnResult> {
    const machineId = id.replace('htb-', '')

    try {
      const data = await this.request<{
        success: string
        status: string
        message?: string
      }>('/vm/spawn', {
        method: 'POST',
        body: JSON.stringify({ machine_id: parseInt(machineId) }),
      })

      if (data.success === '1') {
        const machine = await this.pollForIP(machineId)
        return {
          success: true,
          machineId: id,
          ip: machine?.ip,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        }
      }

      return {
        success: false,
        machineId: id,
        error: data.message || 'Failed to spawn machine',
      }
    } catch (err) {
      return {
        success: false,
        machineId: id,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  private async pollForIP(machineId: string, maxAttempts = 30): Promise<Machine | null> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const machine = await this.getMachine(machineId)
      if (machine?.ip) return machine
    }
    return null
  }

  async stopMachine(id: string): Promise<{ success: boolean; error?: string }> {
    const machineId = id.replace('htb-', '')

    try {
      await this.request('/vm/terminate', {
        method: 'POST',
        body: JSON.stringify({ machine_id: parseInt(machineId) }),
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
    const machineId = id.replace('htb-', '')

    try {
      await this.request('/vm/extend', {
        method: 'POST',
        body: JSON.stringify({ machine_id: parseInt(machineId) }),
      })
      return {
        success: true,
        newExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      }
    } catch {
      return { success: false }
    }
  }

  // ─── Flags ─────────────────────────────────────────────────────────────────

  async submitFlag(machineId: string, flag: string): Promise<FlagResult> {
    const id = machineId.replace('htb-', '')

    try {
      // Try user flag first
      const userRes = await this.request<{
        success: string
        status: string
        message?: string
      }>(`/machine/own/user/${id}`, {
        method: 'POST',
        body: JSON.stringify({ flag }),
      })

      if (userRes.success === '1') {
        return {
          success: true,
          correct: true,
          flagType: 'user',
          message: 'User flag correct!',
        }
      }

      // Try root flag
      const rootRes = await this.request<{
        success: string
        status: string
        message?: string
      }>(`/machine/own/root/${id}`, {
        method: 'POST',
        body: JSON.stringify({ flag }),
      })

      if (rootRes.success === '1') {
        return {
          success: true,
          correct: true,
          flagType: 'root',
          message: 'Root flag correct! Machine owned!',
        }
      }

      return {
        success: true,
        correct: false,
        message: 'Incorrect flag. Keep trying!',
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
        info: {
          id: number
          name: string
          os: string
          difficulty: number
          release: string
          ip: string
        } | null
      }>('/machine/active')

      if (!data.info) return null

      return this.mapMachine({ ...data.info, active: 1 })
    } catch {
      return null
    }
  }
}

export const htbClient = new HackTheBoxClient()
