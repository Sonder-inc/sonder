import { spawnSync } from 'child_process'
import { homedir, platform, arch } from 'os'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

const REPO = 'Sonder-inc/sonder'
const INSTALL_DIR = process.env.SONDER_INSTALL_DIR || join(homedir(), '.sonder')
const VERSION_FILE = join(INSTALL_DIR, 'version')

function getCurrentVersion(): string {
  if (existsSync(VERSION_FILE)) {
    return readFileSync(VERSION_FILE, 'utf-8').trim()
  }
  // Fallback to package.json version for dev
  try {
    const pkg = require('../../package.json') as { version?: string }
    return pkg.version || 'dev'
  } catch {
    return 'dev'
  }
}

function getPlatform(): string {
  const os = platform() === 'darwin' ? 'darwin' : 'linux'
  const cpu = arch() === 'arm64' ? 'arm64' : 'x64'
  return `${os}-${cpu}`
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'sonder-cli' },
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) {
      return null
    }
    const data = (await response.json()) as { tag_name?: string }
    return data.tag_name || null
  } catch {
    return null
  }
}

export async function checkForUpdates(): Promise<{
  available: boolean
  currentVersion: string
  latestVersion: string
} | null> {
  const currentVersion = getCurrentVersion()

  // Skip in dev mode
  if (currentVersion === 'dev') {
    return null
  }

  const latestVersion = await fetchLatestVersion()
  if (!latestVersion) {
    return null
  }

  const available = latestVersion !== currentVersion

  return {
    available,
    currentVersion,
    latestVersion,
  }
}

export function performUpdate(version: string): boolean {
  const plat = getPlatform()
  const url = `https://github.com/${REPO}/releases/download/${version}/sonder-${plat}.tar.gz`

  // Download and extract
  const result = spawnSync('bash', ['-c', `
    TMP=$(mktemp -d)
    curl -fsSL "${url}" -o "$TMP/sonder.tar.gz" &&
    tar -xzf "$TMP/sonder.tar.gz" -C "${INSTALL_DIR}" &&
    rm -rf "$TMP"
  `], {
    stdio: 'inherit',
  })

  if (result.status === 0) {
    try {
      mkdirSync(INSTALL_DIR, { recursive: true })
      writeFileSync(VERSION_FILE, version)
    } catch {
      // Ignore
    }
    return true
  }

  return false
}
