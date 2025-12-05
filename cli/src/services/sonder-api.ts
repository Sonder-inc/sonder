/**
 * Mock Sonder API client
 * Will be replaced with real API calls when backend is ready
 */

import type {
  Machine,
  SpawnResult,
  FlagResult,
  ChatMessage,
  PvPMatch,
  Platform,
  User,
} from '../types/platform'

// Mock data
const MOCK_MACHINES: Machine[] = [
  {
    id: 'htb-lame',
    name: 'Lame',
    platform: 'htb',
    difficulty: 'easy',
    os: 'linux',
    status: 'offline',
    userOwned: false,
    rootOwned: false,
    releaseDate: new Date('2017-03-14'),
    tags: ['smb', 'distcc', 'cve'],
  },
  {
    id: 'htb-blue',
    name: 'Blue',
    platform: 'htb',
    difficulty: 'easy',
    os: 'windows',
    status: 'offline',
    userOwned: true,
    rootOwned: false,
    releaseDate: new Date('2017-07-28'),
    tags: ['smb', 'ms17-010', 'eternalblue'],
  },
  {
    id: 'thm-basic-pentesting',
    name: 'Basic Pentesting',
    platform: 'thm',
    difficulty: 'easy',
    os: 'linux',
    status: 'offline',
    userOwned: false,
    rootOwned: false,
    releaseDate: new Date('2019-01-15'),
    tags: ['enum', 'brute-force', 'privesc'],
  },
  {
    id: 'sonder-vuln-1',
    name: 'Sonder Starter',
    platform: 'sonder',
    difficulty: 'easy',
    os: 'linux',
    status: 'offline',
    userOwned: false,
    rootOwned: false,
    releaseDate: new Date('2024-01-01'),
    tags: ['beginner', 'web', 'ssh'],
  },
  {
    id: 'htb-devvortex',
    name: 'Devvortex',
    platform: 'htb',
    difficulty: 'medium',
    os: 'linux',
    status: 'offline',
    userOwned: false,
    rootOwned: false,
    releaseDate: new Date('2023-11-25'),
    tags: ['joomla', 'cve', 'apport'],
  },
]

const MOCK_HINTS: ChatMessage[] = [
  {
    id: 'hint-1',
    oderId: 'user-1',
    authorName: 'h4ck3r_42',
    content: 'Have you tried running nmap with -sV flag?',
    type: 'hint',
    spoilerLevel: 0,
    timestamp: new Date(Date.now() - 3600000),
    machineId: 'htb-lame',
  },
  {
    id: 'hint-2',
    oderId: 'user-2',
    authorName: 'pentester_pro',
    content: 'Look at the SMB version carefully...',
    type: 'hint',
    spoilerLevel: 1,
    timestamp: new Date(Date.now() - 1800000),
    machineId: 'htb-lame',
  },
  {
    id: 'hint-3',
    oderId: 'user-3',
    authorName: 'ctf_wizard',
    content: 'CVE-2007-2447 - Samba usermap script',
    type: 'hint',
    spoilerLevel: 2,
    timestamp: new Date(Date.now() - 900000),
    machineId: 'htb-lame',
  },
  {
    id: 'hint-4',
    oderId: 'user-1',
    authorName: 'h4ck3r_42',
    content: 'msfconsole > use exploit/multi/samba/usermap_script',
    type: 'hint',
    spoilerLevel: 3,
    timestamp: new Date(Date.now() - 300000),
    machineId: 'htb-lame',
  },
]

const MOCK_USER: User = {
  id: 'mock-user-1',
  name: 'sonder_user',
  email: 'user@trysonder.ai',
}

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

class SonderAPI {
  private baseUrl = 'https://api.trysonder.ai'
  private token: string | null = null
  private user: User | null = null

  // Track spawned machine state
  private spawnedMachine: { id: string; ip: string; expiresAt: Date } | null = null

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.user
  }

  /**
   * Mock login - in real implementation opens browser for OAuth
   */
  async login(): Promise<User> {
    await delay(500)
    this.token = 'mock-token-12345'
    this.user = MOCK_USER
    return this.user
  }

  /**
   * Logout
   */
  logout(): void {
    this.token = null
    this.user = null
  }

  /**
   * List available machines
   */
  async listMachines(filters?: {
    platform?: Platform
    difficulty?: string
    search?: string
  }): Promise<Machine[]> {
    await delay(300)

    let machines = [...MOCK_MACHINES]

    // Update spawned machine status
    if (this.spawnedMachine) {
      machines = machines.map(m =>
        m.id === this.spawnedMachine?.id
          ? { ...m, status: 'running' as const, ip: this.spawnedMachine.ip }
          : m
      )
    }

    if (filters?.platform) {
      machines = machines.filter(m => m.platform === filters.platform)
    }

    if (filters?.difficulty) {
      machines = machines.filter(m => m.difficulty === filters.difficulty)
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase()
      machines = machines.filter(
        m =>
          m.name.toLowerCase().includes(search) ||
          m.tags.some(t => t.toLowerCase().includes(search))
      )
    }

    return machines
  }

  /**
   * Get machine details
   */
  async getMachine(machineId: string): Promise<Machine | null> {
    await delay(200)
    let machine = MOCK_MACHINES.find(m => m.id === machineId) || null

    if (machine && this.spawnedMachine?.id === machineId) {
      machine = {
        ...machine,
        status: 'running',
        ip: this.spawnedMachine.ip,
      }
    }

    return machine
  }

  /**
   * Spawn a machine
   */
  async spawnMachine(machineId: string): Promise<SpawnResult> {
    await delay(2000) // Simulate spawn time

    const machine = MOCK_MACHINES.find(m => m.id === machineId)
    if (!machine) {
      return {
        success: false,
        machineId,
        error: 'Machine not found',
      }
    }

    // Generate mock IP
    const ip = `10.10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

    this.spawnedMachine = { id: machineId, ip, expiresAt }

    return {
      success: true,
      machineId,
      ip,
      expiresAt,
    }
  }

  /**
   * Stop a machine
   */
  async stopMachine(machineId: string): Promise<{ success: boolean }> {
    await delay(1000)

    if (this.spawnedMachine?.id === machineId) {
      this.spawnedMachine = null
    }

    return { success: true }
  }

  /**
   * Submit a flag
   */
  async submitFlag(machineId: string, flag: string): Promise<FlagResult> {
    await delay(500)

    // Mock flag validation
    const isUserFlag = flag.toLowerCase().includes('user')
    const isRootFlag = flag.toLowerCase().includes('root')

    if (flag.length === 32 && (isUserFlag || isRootFlag)) {
      return {
        success: true,
        correct: true,
        flagType: isRootFlag ? 'root' : 'user',
        message: `${isRootFlag ? 'Root' : 'User'} flag submitted successfully!`,
      }
    }

    return {
      success: true,
      correct: false,
      message: 'Incorrect flag. Keep trying!',
    }
  }

  /**
   * Get hints for a machine
   */
  async getHints(machineId: string, maxSpoilerLevel?: number): Promise<ChatMessage[]> {
    await delay(300)

    let hints = MOCK_HINTS.filter(h => h.machineId === machineId)

    if (maxSpoilerLevel !== undefined) {
      hints = hints.filter(h => h.spoilerLevel <= maxSpoilerLevel)
    }

    return hints
  }

  /**
   * Send a hint
   */
  async sendHint(
    machineId: string,
    content: string,
    spoilerLevel: 0 | 1 | 2 | 3
  ): Promise<ChatMessage> {
    await delay(300)

    const hint: ChatMessage = {
      id: `hint-${Date.now()}`,
      oderId: this.user?.id || 'anonymous',
      authorName: this.user?.name || 'Anonymous',
      content,
      type: 'hint',
      spoilerLevel,
      timestamp: new Date(),
      machineId,
    }

    MOCK_HINTS.push(hint)
    return hint
  }

  /**
   * Get active PvP matches
   */
  async getPvPMatches(machineId?: string): Promise<PvPMatch[]> {
    await delay(300)

    const matches: PvPMatch[] = [
      {
        id: 'pvp-1',
        machineId: 'htb-lame',
        machineName: 'Lame',
        status: 'waiting',
        participants: [
          { oderId: 'user-5', name: 'speed_runner' },
        ],
        createdAt: new Date(Date.now() - 300000),
      },
      {
        id: 'pvp-2',
        machineId: 'htb-blue',
        machineName: 'Blue',
        status: 'in_progress',
        participants: [
          { oderId: 'user-6', name: 'pwn_master', userFlagAt: new Date(Date.now() - 1200000) },
          { oderId: 'user-7', name: 'noob_hacker' },
        ],
        createdAt: new Date(Date.now() - 1800000),
        startedAt: new Date(Date.now() - 1500000),
      },
    ]

    if (machineId) {
      return matches.filter(m => m.machineId === machineId)
    }

    return matches
  }

  /**
   * Create a PvP match
   */
  async createPvPMatch(machineId: string): Promise<PvPMatch> {
    await delay(500)

    const machine = MOCK_MACHINES.find(m => m.id === machineId)

    return {
      id: `pvp-${Date.now()}`,
      machineId,
      machineName: machine?.name || 'Unknown',
      status: 'waiting',
      participants: [
        { oderId: this.user?.id || 'mock-user-1', name: this.user?.name || 'You' },
      ],
      createdAt: new Date(),
    }
  }

  /**
   * Join a PvP match
   */
  async joinPvPMatch(matchId: string): Promise<PvPMatch> {
    await delay(500)

    // Return mock joined match
    return {
      id: matchId,
      machineId: 'htb-lame',
      machineName: 'Lame',
      status: 'waiting',
      participants: [
        { oderId: 'user-5', name: 'speed_runner' },
        { oderId: this.user?.id || 'mock-user-1', name: this.user?.name || 'You' },
      ],
      createdAt: new Date(Date.now() - 300000),
    }
  }

  /**
   * Run command on attacker VM (mock)
   */
  async runCommand(command: string): Promise<{ output: string; exitCode: number }> {
    await delay(500 + Math.random() * 500)

    // Mock command responses
    if (command.startsWith('nmap')) {
      return {
        output: `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for ${this.spawnedMachine?.ip || '10.10.10.1'}
Host is up (0.045s latency).
Not shown: 997 filtered ports
PORT    STATE SERVICE
21/tcp  open  ftp
22/tcp  open  ssh
139/tcp open  netbios-ssn
445/tcp open  microsoft-ds

Nmap done: 1 IP address (1 host up) scanned in 4.52 seconds`,
        exitCode: 0,
      }
    }

    if (command === 'whoami') {
      return { output: 'root', exitCode: 0 }
    }

    if (command === 'id') {
      return { output: 'uid=0(root) gid=0(root) groups=0(root)', exitCode: 0 }
    }

    if (command.startsWith('cat ')) {
      return { output: `[mock] Contents of ${command.slice(4)}`, exitCode: 0 }
    }

    return {
      output: `[mock] Command executed: ${command}`,
      exitCode: 0,
    }
  }
}

// Singleton instance
export const sonderAPI = new SonderAPI()
