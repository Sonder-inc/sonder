import { execSync } from 'child_process'
import { platform, release, arch, homedir, hostname, cpus, totalmem } from 'os'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface SystemFingerprint {
  // OS Info
  platform: string
  osVersion: string
  arch: string
  hostname: string

  // Hardware
  cpuModel: string
  cpuCores: number
  totalMemoryGB: number

  // Terminal
  terminal: string
  shell: string
  terminalSize: { cols: number; rows: number }
  colorSupport: string

  // Sonder
  sonderVersion: string
  nodeVersion: string
  bunVersion: string

  // Environment
  isDocker: boolean
  isSSH: boolean
  locale: string
  timezone: string

  // Recent errors (if any)
  recentLogs?: string
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return 'unknown'
  }
}

function detectTerminal(): string {
  // Check common terminal env vars
  if (process.env.TERM_PROGRAM) return process.env.TERM_PROGRAM
  if (process.env.TERMINAL_EMULATOR) return process.env.TERMINAL_EMULATOR
  if (process.env.COLORTERM) return process.env.COLORTERM
  if (process.env.WT_SESSION) return 'Windows Terminal'
  if (process.env.KONSOLE_VERSION) return 'Konsole'
  if (process.env.GNOME_TERMINAL_SCREEN) return 'GNOME Terminal'
  if (process.env.ITERM_SESSION_ID) return 'iTerm2'
  if (process.env.ALACRITTY_LOG) return 'Alacritty'
  if (process.env.KITTY_WINDOW_ID) return 'Kitty'
  return process.env.TERM || 'unknown'
}

function detectColorSupport(): string {
  if (process.env.COLORTERM === 'truecolor') return 'truecolor (24-bit)'
  if (process.env.COLORTERM === '256color') return '256 colors'
  if (process.env.TERM?.includes('256color')) return '256 colors'
  if (process.env.TERM?.includes('color')) return '16 colors'
  return process.env.TERM || 'unknown'
}

function isDocker(): boolean {
  // Check for Docker-specific files
  if (existsSync('/.dockerenv')) return true
  try {
    const cgroup = readFileSync('/proc/1/cgroup', 'utf-8')
    return cgroup.includes('docker') || cgroup.includes('kubepods')
  } catch {
    return false
  }
}

function isSSH(): boolean {
  return !!(process.env.SSH_CLIENT || process.env.SSH_TTY || process.env.SSH_CONNECTION)
}

function getBunVersion(): string {
  try {
    return safeExec('bun --version')
  } catch {
    return 'not installed'
  }
}

function getRecentLogs(): string | undefined {
  // Try to get last 20 lines of sonder logs if they exist
  const logPath = join(homedir(), '.sonder', 'logs', 'sonder.log')
  try {
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf-8')
      const lines = content.split('\n').slice(-20)
      return lines.join('\n')
    }
  } catch {
    // Ignore
  }
  return undefined
}

export function collectFingerprint(sonderVersion: string): SystemFingerprint {
  const cpu = cpus()[0]

  return {
    // OS Info
    platform: platform(),
    osVersion: release(),
    arch: arch(),
    hostname: hostname(),

    // Hardware
    cpuModel: cpu?.model || 'unknown',
    cpuCores: cpus().length,
    totalMemoryGB: Math.round(totalmem() / (1024 * 1024 * 1024)),

    // Terminal
    terminal: detectTerminal(),
    shell: process.env.SHELL || process.env.COMSPEC || 'unknown',
    terminalSize: {
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    },
    colorSupport: detectColorSupport(),

    // Sonder
    sonderVersion,
    nodeVersion: process.version,
    bunVersion: getBunVersion(),

    // Environment
    isDocker: isDocker(),
    isSSH: isSSH(),
    locale: process.env.LANG || process.env.LC_ALL || 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',

    // Recent errors
    recentLogs: getRecentLogs(),
  }
}

export function formatFingerprint(fp: SystemFingerprint): string {
  const sections = [
    '## System Info',
    `- **OS**: ${fp.platform} ${fp.osVersion} (${fp.arch})`,
    `- **Host**: ${fp.hostname}`,
    `- **CPU**: ${fp.cpuModel} (${fp.cpuCores} cores)`,
    `- **RAM**: ${fp.totalMemoryGB} GB`,
    '',
    '## Terminal',
    `- **Terminal**: ${fp.terminal}`,
    `- **Shell**: ${fp.shell}`,
    `- **Size**: ${fp.terminalSize.cols}x${fp.terminalSize.rows}`,
    `- **Colors**: ${fp.colorSupport}`,
    '',
    '## Environment',
    `- **Sonder**: v${fp.sonderVersion}`,
    `- **Node**: ${fp.nodeVersion}`,
    `- **Bun**: ${fp.bunVersion}`,
    `- **Docker**: ${fp.isDocker ? 'Yes' : 'No'}`,
    `- **SSH**: ${fp.isSSH ? 'Yes' : 'No'}`,
    `- **Locale**: ${fp.locale}`,
    `- **Timezone**: ${fp.timezone}`,
  ]

  if (fp.recentLogs) {
    sections.push('', '## Recent Logs', '```', fp.recentLogs, '```')
  }

  return sections.join('\n')
}
