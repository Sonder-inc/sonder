/**
 * Cyber 75 - The curated list of 75 boxes organized by attack pattern
 * Like NeetCode 150, but for hackers
 */

export type Cyber75Category =
  | 'fundamentals'
  | 'injection'
  | 'access_api'
  | 'shells'
  | 'linux_privesc'
  | 'windows_privesc'
  | 'buffer_overflow'
  | 'active_directory'

export interface Cyber75Box {
  id: string
  name: string
  platform: 'htb' | 'thm'
  category: Cyber75Category
  order: number
  difficulty: 'easy' | 'medium' | 'hard' | 'insane'
  os: 'linux' | 'windows'
  // Platform-specific IDs for API calls
  platformId?: string
}

export interface CategoryInfo {
  id: Cyber75Category
  name: string
  shortName: string
  description: string
  count: number
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'fundamentals', name: 'Fundamentals', shortName: 'Fund.', description: 'Linux, Windows, Nmap, Burp basics', count: 14 },
  { id: 'injection', name: 'Injection Patterns', shortName: 'Inject.', description: 'SQLi, XSS, Command Injection, LFI', count: 17 },
  { id: 'access_api', name: 'Broken Access & API', shortName: 'Access', description: 'SSRF, IDOR, SSTI', count: 5 },
  { id: 'shells', name: 'Shells & Known Exploits', shortName: 'Shells', description: 'Samba, EternalBlue, Metasploit', count: 7 },
  { id: 'linux_privesc', name: 'Linux Privilege Escalation', shortName: 'Lin PE', description: 'GTFOBins, Sudo, Cron', count: 8 },
  { id: 'windows_privesc', name: 'Windows Privilege Escalation', shortName: 'Win PE', description: 'Kernel exploits, WebDAV, Tomcat', count: 8 },
  { id: 'buffer_overflow', name: 'Buffer Overflow', shortName: 'BOF', description: 'Classic stack-based BOF', count: 3 },
  { id: 'active_directory', name: 'Active Directory', shortName: 'AD', description: 'Kerberoasting, Bloodhound, GPP', count: 13 },
]

export const CYBER75: Cyber75Box[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // I. FUNDAMENTALS (1-14)
  // Note: platformId is the HTB machine ID or THM room code needed for API calls
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'thm-linux-fund-1', name: 'Linux Fundamentals 1', platform: 'thm', category: 'fundamentals', order: 1, difficulty: 'easy', os: 'linux', platformId: 'linuxfundamentalspart1' },
  { id: 'thm-linux-fund-2', name: 'Linux Fundamentals 2', platform: 'thm', category: 'fundamentals', order: 2, difficulty: 'easy', os: 'linux', platformId: 'linuxfundamentalspart2' },
  { id: 'thm-linux-fund-3', name: 'Linux Fundamentals 3', platform: 'thm', category: 'fundamentals', order: 3, difficulty: 'easy', os: 'linux', platformId: 'linuxfundamentalspart3' },
  { id: 'htb-meow', name: 'Meow', platform: 'htb', category: 'fundamentals', order: 4, difficulty: 'easy', os: 'linux', platformId: '394' },
  { id: 'thm-windows-fund-1', name: 'Windows Fundamentals 1', platform: 'thm', category: 'fundamentals', order: 5, difficulty: 'easy', os: 'windows', platformId: 'windowsfundamentals1xbx' },
  { id: 'thm-windows-fund-2', name: 'Windows Fundamentals 2', platform: 'thm', category: 'fundamentals', order: 6, difficulty: 'easy', os: 'windows', platformId: 'windowsfundamentals2x0x' },
  { id: 'htb-fawn', name: 'Fawn', platform: 'htb', category: 'fundamentals', order: 7, difficulty: 'easy', os: 'linux', platformId: '393' },
  { id: 'thm-nmap-discovery', name: 'Nmap Live Host Discovery', platform: 'thm', category: 'fundamentals', order: 8, difficulty: 'easy', os: 'linux', platformId: 'nmap01' },
  { id: 'htb-appointment', name: 'Appointment', platform: 'htb', category: 'fundamentals', order: 9, difficulty: 'easy', os: 'linux', platformId: '396' },
  { id: 'thm-web-fund', name: 'Web Fundamentals', platform: 'thm', category: 'fundamentals', order: 10, difficulty: 'easy', os: 'linux', platformId: 'webfundamentals' },
  { id: 'htb-dancing', name: 'Dancing', platform: 'htb', category: 'fundamentals', order: 11, difficulty: 'easy', os: 'windows', platformId: '395' },
  { id: 'htb-sequel', name: 'Sequel', platform: 'htb', category: 'fundamentals', order: 12, difficulty: 'easy', os: 'linux', platformId: '398' },
  { id: 'thm-burp-basics', name: 'Burp Suite Basics', platform: 'thm', category: 'fundamentals', order: 13, difficulty: 'easy', os: 'linux', platformId: 'burpsuitebasics' },
  { id: 'thm-hydra', name: 'Hydra', platform: 'thm', category: 'fundamentals', order: 14, difficulty: 'easy', os: 'linux', platformId: 'hydra' },

  // ═══════════════════════════════════════════════════════════════════════════
  // II. INJECTION PATTERNS (15-31)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'thm-sqli', name: 'SQL Injection', platform: 'thm', category: 'injection', order: 15, difficulty: 'easy', os: 'linux' },
  { id: 'thm-sqlmap', name: 'SQLMap', platform: 'thm', category: 'injection', order: 16, difficulty: 'easy', os: 'linux' },
  { id: 'htb-jarvis', name: 'Jarvis', platform: 'htb', category: 'injection', order: 17, difficulty: 'medium', os: 'linux' },
  { id: 'htb-giddy', name: 'Giddy', platform: 'htb', category: 'injection', order: 18, difficulty: 'medium', os: 'windows' },
  { id: 'thm-xss', name: 'Cross-site Scripting', platform: 'thm', category: 'injection', order: 19, difficulty: 'easy', os: 'linux' },
  { id: 'htb-alert', name: 'Alert', platform: 'htb', category: 'injection', order: 20, difficulty: 'easy', os: 'linux' },
  { id: 'htb-holiday', name: 'Holiday', platform: 'htb', category: 'injection', order: 21, difficulty: 'hard', os: 'linux' },
  { id: 'thm-command-injection', name: 'Command Injection', platform: 'thm', category: 'injection', order: 22, difficulty: 'easy', os: 'linux' },
  { id: 'htb-shocker', name: 'Shocker', platform: 'htb', category: 'injection', order: 23, difficulty: 'easy', os: 'linux' },
  { id: 'htb-netmon', name: 'NetMon', platform: 'htb', category: 'injection', order: 24, difficulty: 'easy', os: 'windows' },
  { id: 'thm-lfi', name: 'File Inclusion', platform: 'thm', category: 'injection', order: 25, difficulty: 'easy', os: 'linux' },
  { id: 'htb-poison', name: 'Poison', platform: 'htb', category: 'injection', order: 26, difficulty: 'medium', os: 'linux' },
  { id: 'htb-nineveh', name: 'Nineveh', platform: 'htb', category: 'injection', order: 27, difficulty: 'medium', os: 'linux' },
  { id: 'thm-upload-vulns', name: 'Upload Vulnerabilities', platform: 'thm', category: 'injection', order: 28, difficulty: 'easy', os: 'linux' },
  { id: 'htb-remote', name: 'Remote', platform: 'htb', category: 'injection', order: 29, difficulty: 'easy', os: 'windows' },
  { id: 'htb-magic', name: 'Magic', platform: 'htb', category: 'injection', order: 30, difficulty: 'medium', os: 'linux' },

  // ═══════════════════════════════════════════════════════════════════════════
  // III. BROKEN ACCESS & API (31-35)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'thm-ssrf', name: 'SSRF', platform: 'thm', category: 'access_api', order: 31, difficulty: 'easy', os: 'linux' },
  { id: 'thm-idor', name: 'IDOR', platform: 'thm', category: 'access_api', order: 32, difficulty: 'easy', os: 'linux' },
  { id: 'thm-ssti', name: 'Server Side Template Injection', platform: 'thm', category: 'access_api', order: 33, difficulty: 'medium', os: 'linux' },
  { id: 'htb-templated', name: 'Templated', platform: 'htb', category: 'access_api', order: 34, difficulty: 'easy', os: 'linux' },
  { id: 'htb-bounty', name: 'Bounty', platform: 'htb', category: 'access_api', order: 35, difficulty: 'easy', os: 'windows' },

  // ═══════════════════════════════════════════════════════════════════════════
  // IV. SHELLS & KNOWN EXPLOITS (36-42)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'thm-what-the-shell', name: 'What the Shell?', platform: 'thm', category: 'shells', order: 36, difficulty: 'easy', os: 'linux' },
  { id: 'htb-lame', name: 'Lame', platform: 'htb', category: 'shells', order: 37, difficulty: 'easy', os: 'linux' },
  { id: 'htb-legacy', name: 'Legacy', platform: 'htb', category: 'shells', order: 38, difficulty: 'easy', os: 'windows' },
  { id: 'htb-blue', name: 'Blue', platform: 'htb', category: 'shells', order: 39, difficulty: 'easy', os: 'windows' },
  { id: 'htb-nibbles', name: 'Nibbles', platform: 'htb', category: 'shells', order: 40, difficulty: 'easy', os: 'linux' },
  { id: 'htb-friendzone', name: 'FriendZone', platform: 'htb', category: 'shells', order: 41, difficulty: 'easy', os: 'linux' },
  { id: 'htb-scriptkiddie', name: 'ScriptKiddie', platform: 'htb', category: 'shells', order: 42, difficulty: 'easy', os: 'linux' },

  // ═══════════════════════════════════════════════════════════════════════════
  // V. LINUX PRIVILEGE ESCALATION (43-50)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'thm-linux-privesc', name: 'Linux PrivEsc', platform: 'thm', category: 'linux_privesc', order: 43, difficulty: 'medium', os: 'linux' },
  { id: 'thm-common-linux-privesc', name: 'Common Linux Privesc', platform: 'thm', category: 'linux_privesc', order: 44, difficulty: 'easy', os: 'linux' },
  { id: 'htb-openadmin', name: 'OpenAdmin', platform: 'htb', category: 'linux_privesc', order: 45, difficulty: 'easy', os: 'linux' },
  { id: 'htb-admirer', name: 'Admirer', platform: 'htb', category: 'linux_privesc', order: 46, difficulty: 'easy', os: 'linux' },
  { id: 'htb-bashed', name: 'Bashed', platform: 'htb', category: 'linux_privesc', order: 47, difficulty: 'easy', os: 'linux' },
  { id: 'htb-blocky', name: 'Blocky', platform: 'htb', category: 'linux_privesc', order: 48, difficulty: 'easy', os: 'linux' },
  { id: 'htb-iced', name: 'Iced', platform: 'htb', category: 'linux_privesc', order: 49, difficulty: 'medium', os: 'linux' },
  { id: 'thm-daily-bugle', name: 'Daily Bugle', platform: 'thm', category: 'linux_privesc', order: 50, difficulty: 'hard', os: 'linux' },

  // ═══════════════════════════════════════════════════════════════════════════
  // VI. WINDOWS PRIVILEGE ESCALATION (51-58)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'thm-windows-privesc', name: 'Windows PrivEsc', platform: 'thm', category: 'windows_privesc', order: 51, difficulty: 'medium', os: 'windows' },
  { id: 'htb-optimum', name: 'Optimum', platform: 'htb', category: 'windows_privesc', order: 52, difficulty: 'easy', os: 'windows' },
  { id: 'htb-granny', name: 'Granny', platform: 'htb', category: 'windows_privesc', order: 53, difficulty: 'easy', os: 'windows' },
  { id: 'htb-grandpa', name: 'Grandpa', platform: 'htb', category: 'windows_privesc', order: 54, difficulty: 'easy', os: 'windows' },
  { id: 'htb-bastion', name: 'Bastion', platform: 'htb', category: 'windows_privesc', order: 55, difficulty: 'easy', os: 'windows' },
  { id: 'htb-devel', name: 'Devel', platform: 'htb', category: 'windows_privesc', order: 56, difficulty: 'easy', os: 'windows' },
  { id: 'htb-arctic', name: 'Arctic', platform: 'htb', category: 'windows_privesc', order: 57, difficulty: 'easy', os: 'windows' },
  { id: 'htb-jerry', name: 'Jerry', platform: 'htb', category: 'windows_privesc', order: 58, difficulty: 'easy', os: 'windows' },

  // ═══════════════════════════════════════════════════════════════════════════
  // VII. BUFFER OVERFLOW (59-61)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'thm-bof-prep', name: 'Buffer Overflow Prep', platform: 'thm', category: 'buffer_overflow', order: 59, difficulty: 'medium', os: 'windows' },
  { id: 'thm-brainpan', name: 'Brainpan 1', platform: 'thm', category: 'buffer_overflow', order: 60, difficulty: 'medium', os: 'linux' },
  { id: 'htb-brainpan', name: 'Brainpan', platform: 'htb', category: 'buffer_overflow', order: 61, difficulty: 'medium', os: 'linux' },

  // ═══════════════════════════════════════════════════════════════════════════
  // VIII. ACTIVE DIRECTORY (62-75)
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'thm-ad-basics', name: 'Active Directory Basics', platform: 'thm', category: 'active_directory', order: 62, difficulty: 'easy', os: 'windows' },
  { id: 'thm-attacktive-ad', name: 'Attacktive Directory', platform: 'thm', category: 'active_directory', order: 63, difficulty: 'medium', os: 'windows' },
  { id: 'thm-breaching-ad', name: 'Breaching Active Directory', platform: 'thm', category: 'active_directory', order: 64, difficulty: 'medium', os: 'windows' },
  { id: 'htb-active', name: 'Active', platform: 'htb', category: 'active_directory', order: 65, difficulty: 'easy', os: 'windows' },
  { id: 'htb-forest', name: 'Forest', platform: 'htb', category: 'active_directory', order: 66, difficulty: 'easy', os: 'windows' },
  { id: 'htb-sauna', name: 'Sauna', platform: 'htb', category: 'active_directory', order: 67, difficulty: 'easy', os: 'windows' },
  { id: 'htb-monteverde', name: 'Monteverde', platform: 'htb', category: 'active_directory', order: 68, difficulty: 'medium', os: 'windows' },
  { id: 'htb-resolute', name: 'Resolute', platform: 'htb', category: 'active_directory', order: 69, difficulty: 'medium', os: 'windows' },
  { id: 'htb-cascade', name: 'Cascade', platform: 'htb', category: 'active_directory', order: 70, difficulty: 'medium', os: 'windows' },
  { id: 'htb-intelligence', name: 'Intelligence', platform: 'htb', category: 'active_directory', order: 71, difficulty: 'medium', os: 'windows' },
  { id: 'thm-wreath', name: 'Wreath', platform: 'thm', category: 'active_directory', order: 72, difficulty: 'hard', os: 'linux' },
  { id: 'htb-blackfield', name: 'Blackfield', platform: 'htb', category: 'active_directory', order: 73, difficulty: 'hard', os: 'windows' },
  { id: 'htb-sizzle', name: 'Sizzle', platform: 'htb', category: 'active_directory', order: 74, difficulty: 'insane', os: 'windows' },
]

// Helper functions
export function getBoxesByCategory(category: Cyber75Category): Cyber75Box[] {
  return CYBER75.filter(box => box.category === category).sort((a, b) => a.order - b.order)
}

export function getBoxById(id: string): Cyber75Box | undefined {
  return CYBER75.find(box => box.id === id)
}

export function getCategoryProgress(
  category: Cyber75Category,
  progress: Map<string, { user: boolean; root: boolean }>
): { completed: number; total: number } {
  const boxes = getBoxesByCategory(category)
  const completed = boxes.filter(box => {
    const p = progress.get(box.id)
    return p?.user && p?.root
  }).length
  return { completed, total: boxes.length }
}

export function getTotalProgress(
  progress: Map<string, { user: boolean; root: boolean }>
): { completed: number; total: number } {
  const completed = CYBER75.filter(box => {
    const p = progress.get(box.id)
    return p?.user && p?.root
  }).length
  return { completed, total: CYBER75.length }
}
