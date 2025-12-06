import { spawn } from 'child_process'
import { platform } from 'os'

/**
 * Copy text to the system clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const os = platform()
    let cmd: string
    let args: string[]

    if (os === 'darwin') {
      cmd = 'pbcopy'
      args = []
    } else if (os === 'linux') {
      // Try xclip first, fall back to xsel
      cmd = 'xclip'
      args = ['-selection', 'clipboard']
    } else if (os === 'win32') {
      cmd = 'clip'
      args = []
    } else {
      resolve(false)
      return
    }

    try {
      const proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] })

      proc.on('error', () => {
        // Command not found - try fallback on Linux
        if (os === 'linux' && cmd === 'xclip') {
          const fallback = spawn('xsel', ['--clipboard', '--input'], { stdio: ['pipe', 'ignore', 'ignore'] })
          fallback.on('error', () => resolve(false))
          fallback.on('close', (code) => resolve(code === 0))
          fallback.stdin.write(text)
          fallback.stdin.end()
        } else {
          resolve(false)
        }
      })

      proc.on('close', (code) => resolve(code === 0))
      proc.stdin.write(text)
      proc.stdin.end()
    } catch {
      resolve(false)
    }
  })
}

/**
 * Read text from the system clipboard
 */
export async function readFromClipboard(): Promise<string | null> {
  return new Promise((resolve) => {
    const os = platform()
    let cmd: string
    let args: string[]

    if (os === 'darwin') {
      cmd = 'pbpaste'
      args = []
    } else if (os === 'linux') {
      cmd = 'xclip'
      args = ['-selection', 'clipboard', '-o']
    } else if (os === 'win32') {
      cmd = 'powershell'
      args = ['-command', 'Get-Clipboard']
    } else {
      resolve(null)
      return
    }

    try {
      const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] })
      let data = ''

      proc.stdout.on('data', (chunk) => {
        data += chunk.toString()
      })

      proc.on('error', () => {
        // Try fallback on Linux
        if (os === 'linux' && cmd === 'xclip') {
          const fallback = spawn('xsel', ['--clipboard', '--output'], { stdio: ['ignore', 'pipe', 'ignore'] })
          let fallbackData = ''
          fallback.stdout.on('data', (chunk) => {
            fallbackData += chunk.toString()
          })
          fallback.on('error', () => resolve(null))
          fallback.on('close', () => resolve(fallbackData || null))
        } else {
          resolve(null)
        }
      })

      proc.on('close', () => resolve(data || null))
    } catch {
      resolve(null)
    }
  })
}
