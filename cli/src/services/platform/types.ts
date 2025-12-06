/**
 * Platform abstraction layer types
 * Unified interface for HTB, THM, and future platforms
 */

import type { Machine, SpawnResult, FlagResult, Difficulty } from '../../types/platform'

export interface PlatformCredentials {
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
}

export interface PlatformUser {
  id: string
  username: string
  email?: string
  avatar?: string
  rank?: string
  points?: number
}

export interface VPNConfig {
  ovpnPath: string
  server: string
  isConnected: boolean
}

export interface MachineFilters {
  difficulty?: Difficulty
  os?: 'linux' | 'windows'
  search?: string
  retired?: boolean
  owned?: boolean
}

/**
 * Unified platform interface
 * All platform clients implement this interface
 */
export interface IPlatform {
  readonly name: 'htb' | 'thm'
  readonly displayName: string

  // Auth
  isAuthenticated(): boolean
  getAuthUrl(): string
  handleOAuthCallback(code: string): Promise<PlatformCredentials>
  setCredentials(creds: PlatformCredentials): void
  getCredentials(): PlatformCredentials | null
  logout(): void

  // User
  getCurrentUser(): Promise<PlatformUser>

  // VPN
  downloadVPNConfig(): Promise<string> // Returns path to .ovpn file
  getVPNStatus(): Promise<VPNConfig | null>

  // Machines
  listMachines(filters?: MachineFilters): Promise<Machine[]>
  getMachine(id: string): Promise<Machine | null>
  spawnMachine(id: string): Promise<SpawnResult>
  stopMachine(id: string): Promise<{ success: boolean; error?: string }>
  extendMachine(id: string): Promise<{ success: boolean; newExpiresAt?: Date }>

  // Flags
  submitFlag(machineId: string, flag: string): Promise<FlagResult>

  // Active machine
  getActiveMachine(): Promise<Machine | null>
}

/**
 * OAuth state for browser flow
 */
export interface OAuthState {
  platform: 'htb' | 'thm'
  state: string
  codeVerifier?: string // PKCE
  redirectUri: string
}
