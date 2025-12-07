import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

/**
 * User credentials and subscription info
 */
export interface User {
  id: string
  email: string
  name?: string
  authToken: string
  tier: 'free' | 'pro' | 'max' | 'black'
  credits?: number
}

export interface Credentials {
  default: User
}

// Config directory - similar to codebuff's pattern
const CONFIG_DIR = join(homedir(), '.config', 'sonder')
const CREDENTIALS_PATH = join(CONFIG_DIR, 'credentials.json')

/**
 * Get user credentials from file system
 */
export function getUserCredentials(): User | null {
  if (!existsSync(CREDENTIALS_PATH)) {
    return null
  }

  try {
    const content = readFileSync(CREDENTIALS_PATH, 'utf-8')
    const credentials = JSON.parse(content) as Credentials
    return credentials.default || null
  } catch {
    return null
  }
}

/**
 * Check if user is logged in
 */
export function isLoggedIn(): boolean {
  return getUserCredentials() !== null
}

/**
 * Get user tier display string
 * Returns 'unknown' if not logged in
 */
export function getUserTier(): string {
  const user = getUserCredentials()
  if (!user) {
    return 'unknown'
  }
  return `${user.tier} - ${user.tier === 'black' ? 'black' : user.tier}`
}

/**
 * Get user tier info for display
 */
export function getUserTierInfo(): { tier: string; isLoggedIn: boolean } {
  const user = getUserCredentials()
  if (!user) {
    return { tier: 'unknown', isLoggedIn: false }
  }
  return { tier: `${user.tier}`, isLoggedIn: true }
}

/**
 * Save user credentials to file system
 */
export function saveUserCredentials(user: User): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }

  const credentials: Credentials = { default: user }
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2))
}

/**
 * Clear user credentials (logout)
 */
export function clearUserCredentials(): void {
  if (existsSync(CREDENTIALS_PATH)) {
    unlinkSync(CREDENTIALS_PATH)
  }
}

/**
 * Get auth token for API calls
 */
export function getAuthToken(): string | undefined {
  const user = getUserCredentials()
  return user?.authToken
}
