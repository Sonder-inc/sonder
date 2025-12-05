/**
 * Platform types for HTB/THM/Sonder integration
 */

export type Platform = 'htb' | 'thm' | 'sonder'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'insane'

export type MachineStatus = 'offline' | 'spawning' | 'running' | 'stopping'

export interface Machine {
  id: string
  name: string
  platform: Platform
  difficulty: Difficulty
  os: 'linux' | 'windows'
  ip?: string
  status: MachineStatus
  userOwned: boolean
  rootOwned: boolean
  releaseDate: Date
  tags: string[]
}

export interface SpawnResult {
  success: boolean
  machineId: string
  ip?: string
  expiresAt?: Date
  error?: string
}

export interface FlagResult {
  success: boolean
  correct: boolean
  flagType?: 'user' | 'root'
  message: string
}

export interface ChatMessage {
  id: string
  oderId: string
  authorName: string
  content: string
  type: 'hint' | 'chat' | 'system'
  spoilerLevel: 0 | 1 | 2 | 3 // 0=no spoiler, 3=full solution
  timestamp: Date
  machineId: string
}

export interface PvPMatch {
  id: string
  machineId: string
  machineName: string
  status: 'waiting' | 'in_progress' | 'completed'
  participants: PvPParticipant[]
  createdAt: Date
  startedAt?: Date
  endedAt?: Date
}

export interface PvPParticipant {
  oderId: string
  name: string
  userFlagAt?: Date
  rootFlagAt?: Date
  rank?: number
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

export type SidebarTab = 'chat' | 'vm' | 'pvp'
