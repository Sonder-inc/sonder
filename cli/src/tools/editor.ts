import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, join, isAbsolute } from 'path'

const editorParams = z.object({
  action: z.enum(['read', 'write', 'patch']).describe('read: get file contents, write: create/overwrite, patch: search-replace'),
  path: z.string().describe('File path (relative to cwd or absolute)'),
  content: z.string().optional().describe('For write: full content. For patch: new content to insert.'),
  search: z.string().optional().describe('For patch: text to find and replace'),
})

export const editor = defineTool({
  name: 'edit',
  description: 'Read, write, or patch files. Use read to view, write to create/overwrite, patch for search-replace edits.',
  parameters: editorParams,
  execute: async ({ action, path, content, search }): Promise<ToolResult> => {
    const filePath = isAbsolute(path) ? path : join(process.cwd(), path)

    try {
      switch (action) {
        case 'read': {
          const data = await readFile(filePath, 'utf-8')
          const lines = data.split('\n').length
          const chars = data.length

          // Add line numbers for context
          const numbered = data
            .split('\n')
            .map((line, i) => `${String(i + 1).padStart(4)} │ ${line}`)
            .join('\n')

          return {
            success: true,
            summary: `${lines} lines, ${chars} chars`,
            fullResult: numbered,
          }
        }

        case 'write': {
          if (content === undefined) {
            return {
              success: false,
              summary: 'Missing content',
              fullResult: 'write action requires "content" parameter',
            }
          }

          // Create directory if needed
          await mkdir(dirname(filePath), { recursive: true })
          await writeFile(filePath, content, 'utf-8')

          const lines = content.split('\n').length
          return {
            success: true,
            summary: `Wrote ${lines} lines`,
            fullResult: `File written: ${path} (${lines} lines, ${content.length} chars)`,
          }
        }

        case 'patch': {
          if (!search || content === undefined) {
            return {
              success: false,
              summary: 'Missing params',
              fullResult: 'patch action requires both "search" and "content" parameters',
            }
          }

          const original = await readFile(filePath, 'utf-8')

          if (!original.includes(search)) {
            return {
              success: false,
              summary: 'Not found',
              fullResult: `Search string not found in file:\n"${search.slice(0, 100)}..."`,
            }
          }

          const patched = original.replace(search, content)
          await writeFile(filePath, patched, 'utf-8')

          const diff = `- ${search.split('\n').join('\n- ')}\n+ ${content.split('\n').join('\n+ ')}`

          return {
            success: true,
            summary: 'Patched',
            fullResult: `File patched: ${path}\n\n${diff}`,
          }
        }

        default:
          return {
            success: false,
            summary: 'Invalid action',
            fullResult: `Unknown action: ${action}`,
          }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)

      if (errMsg.includes('ENOENT')) {
        return {
          success: false,
          summary: 'File not found',
          fullResult: `File does not exist: ${path}`,
        }
      }

      return {
        success: false,
        summary: 'Error',
        fullResult: `Error: ${errMsg}`,
      }
    }
  },
})
