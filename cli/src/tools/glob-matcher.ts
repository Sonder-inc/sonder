import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { Glob } from 'bun'

const globParams = z.object({
  pattern: z.string().describe('Glob pattern (e.g., "**/*.ts", "src/**/*.js")'),
  cwd: z.string().optional().describe('Working directory (defaults to process.cwd())'),
  limit: z.number().optional().default(50).describe('Max files to return'),
})

export const globMatcher = defineTool({
  name: 'glob',
  description: 'Find files matching a glob pattern. Use for discovering files by extension or path pattern.',
  parameters: globParams,
  execute: async ({ pattern, cwd, limit }): Promise<ToolResult> => {
    const workDir = cwd || process.cwd()

    try {
      const glob = new Glob(pattern)
      const matches: string[] = []

      for await (const file of glob.scan({ cwd: workDir, onlyFiles: true })) {
        matches.push(file)
        if (matches.length >= limit) break
      }

      if (matches.length === 0) {
        return {
          success: true,
          summary: 'No matches',
          fullResult: `No files match pattern "${pattern}" in ${workDir}`,
        }
      }

      const truncated = matches.length >= limit
      const fileList = matches.join('\n')

      return {
        success: true,
        summary: `${matches.length} file${matches.length > 1 ? 's' : ''}${truncated ? '+' : ''}`,
        fullResult: truncated
          ? `Found ${matches.length}+ files (limited):\n${fileList}`
          : `Found ${matches.length} files:\n${fileList}`,
      }
    } catch (error) {
      return {
        success: false,
        summary: 'Glob failed',
        fullResult: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
})
