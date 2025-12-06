import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { spawn } from 'child_process'

const grepParams = z.object({
  pattern: z.string().describe('Search pattern (regex supported)'),
  path: z.string().optional().default('.').describe('Directory or file to search'),
  filePattern: z.string().optional().describe('Glob for file types (e.g., "*.ts")'),
  caseSensitive: z.boolean().optional().default(false),
  maxResults: z.number().optional().default(50),
})

export const grep = defineTool({
  name: 'grep',
  description: 'Search file contents using ripgrep. Find code, strings, or patterns across files.',
  parameters: grepParams,
  execute: async ({ pattern, path, filePattern, caseSensitive, maxResults }): Promise<ToolResult> => {
    return new Promise((resolve) => {
      const args = [
        '--color=never',
        '--line-number',
        '--no-heading',
        `--max-count=${maxResults}`,
      ]

      if (!caseSensitive) args.push('--ignore-case')
      if (filePattern) args.push('--glob', filePattern)

      args.push(pattern, path)

      // Try ripgrep first, fall back to grep
      const rg = spawn('rg', args, {
        cwd: process.cwd(),
        timeout: 15000,
      })

      let output = ''
      let stderr = ''

      rg.stdout.on('data', (data) => {
        output += data.toString()
      })

      rg.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      rg.on('error', () => {
        // ripgrep not found, try regular grep
        const grepArgs = [
          '-rn',
          caseSensitive ? '' : '-i',
          pattern,
          path,
        ].filter(Boolean)

        const grepProc = spawn('grep', grepArgs, {
          cwd: process.cwd(),
          timeout: 15000,
        })

        let grepOutput = ''

        grepProc.stdout.on('data', (data) => {
          grepOutput += data.toString()
        })

        grepProc.on('close', (code) => {
          if (code === 1 && !grepOutput) {
            resolve({
              success: true,
              summary: 'No matches',
              fullResult: `No matches found for "${pattern}"`,
            })
            return
          }

          const lines = grepOutput.trim().split('\n').filter(Boolean)
          resolve({
            success: true,
            summary: `${lines.length} match${lines.length !== 1 ? 'es' : ''}`,
            fullResult: grepOutput || 'No matches found',
          })
        })
      })

      rg.on('close', (code) => {
        if (stderr.includes('No such file')) {
          resolve({
            success: false,
            summary: 'Path not found',
            fullResult: `Path "${path}" does not exist`,
          })
          return
        }

        if (code === 1 && !output) {
          resolve({
            success: true,
            summary: 'No matches',
            fullResult: `No matches found for "${pattern}"`,
          })
          return
        }

        const lines = output.trim().split('\n').filter(Boolean)
        const truncated = lines.length >= maxResults

        resolve({
          success: true,
          summary: `${lines.length}${truncated ? '+' : ''} match${lines.length !== 1 ? 'es' : ''}`,
          fullResult: output || 'No matches found',
        })
      })
    })
  },
})
