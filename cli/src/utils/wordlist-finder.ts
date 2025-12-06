/**
 * Wordlist Finder Utility
 *
 * Locates common wordlists for pentesting tools.
 * Used by gobuster and hydra agents.
 */

import { existsSync } from 'fs'

/**
 * Common wordlist locations organized by type
 */
export const WORDLISTS = {
  /** Directory enumeration wordlists */
  directory: [
    '/usr/share/wordlists/dirb/common.txt',
    '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt',
    '/usr/share/seclists/Discovery/Web-Content/common.txt',
    '/opt/SecLists/Discovery/Web-Content/common.txt',
  ],

  /** DNS subdomain enumeration wordlists */
  dns: [
    '/usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt',
    '/usr/share/wordlists/dnsrecon/subdomains-top1million-5000.txt',
  ],

  /** Username wordlists */
  usernames: [
    '/usr/share/seclists/Usernames/top-usernames-shortlist.txt',
    '/usr/share/wordlists/metasploit/common_users.txt',
  ],

  /** Password wordlists */
  passwords: [
    '/usr/share/seclists/Passwords/Common-Credentials/top-20-common-SSH-passwords.txt',
    '/usr/share/wordlists/rockyou.txt',
    '/usr/share/seclists/Passwords/Common-Credentials/10k-most-common.txt',
  ],
} as const

export type WordlistType = keyof typeof WORDLISTS

/**
 * Find the first available wordlist of a given type
 */
export function findWordlist(type: WordlistType): string | null {
  const options = WORDLISTS[type]
  for (const path of options) {
    if (existsSync(path)) return path
  }
  return null
}

/**
 * Find the first available wordlist from a custom list of paths
 */
export function findWordlistFromPaths(paths: string[]): string | null {
  for (const path of paths) {
    if (existsSync(path)) return path
  }
  return null
}

/**
 * Check if any wordlists are available for a given type
 */
export function hasWordlistsAvailable(type: WordlistType): boolean {
  return findWordlist(type) !== null
}
