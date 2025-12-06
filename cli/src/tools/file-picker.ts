import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { readdir, stat } from 'fs/promises'
import { join, relative } from 'path'

const filePickerParams = z.object({
  path: z.string().describe('Directory path to explore'),
  depth: z.number().optional().default(2).describe('Max depth to traverse (default 2)'),
  showHidden: z.boolean().optional().default(false).describe('Include hidden files'),
  fileTypes: z.array(z.string()).optional().describe('Filter by extensions (e.g., [".ts", ".js"])'),
})

interface FileEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
}

async function walkDir(
  dir: string,
  base: string,
  depth: number,
  showHidden: boolean,
  fileTypes?: string[]
): Promise<FileEntry[]> {
  if (depth < 0) return []

  const entries: FileEntry[] = []

  try {
    const items = await readdir(dir, { withFileTypes: true })

    for (const item of items) {
      // Skip hidden files unless requested
      if (!showHidden && item.name.startsWith('.')) continue

      // Skip node_modules and common large dirs
      if (item.name === 'node_modules' || item.name === '.git') continue

      const fullPath = join(dir, item.name)
      const relativePath = relative(base, fullPath)

      if (item.isDirectory()) {
        entries.push({ name: item.name, path: relativePath, type: 'dir' })
        if (depth > 0) {
          const subEntries = await walkDir(fullPath, base, depth - 1, showHidden, fileTypes)
          entries.push(...subEntries)
        }
      } else if (item.isFile()) {
        // Filter by extension if specified
        if (fileTypes && fileTypes.length > 0) {
          const hasExt = fileTypes.some(ext => item.name.endsWith(ext))
          if (!hasExt) continue
        }

        try {
          const stats = await stat(fullPath)
          entries.push({
            name: item.name,
            path: relativePath,
            type: 'file',
            size: stats.size,
          })
        } catch {
          entries.push({ name: item.name, path: relativePath, type: 'file' })
        }
      }
    }
  } catch {
    // Directory not readable
  }

  return entries
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

export const filePicker = defineTool({
  name: 'file_picker',
  description: 'Explore directory structure and list files. Useful for understanding project layout.',
  parameters: filePickerParams,
  execute: async ({ path, depth, showHidden, fileTypes }): Promise<ToolResult> => {
    const targetDir = path.startsWith('/') ? path : join(process.cwd(), path)

    try {
      const stats = await stat(targetDir)
      if (!stats.isDirectory()) {
        return {
          success: false,
          summary: 'Not a directory',
          fullResult: `"${path}" is not a directory`,
        }
      }
    } catch {
      return {
        success: false,
        summary: 'Path not found',
        fullResult: `Directory "${path}" does not exist`,
      }
    }

    const entries = await walkDir(targetDir, targetDir, depth, showHidden, fileTypes)

    if (entries.length === 0) {
      return {
        success: true,
        summary: 'Empty directory',
        fullResult: `No files found in "${path}"`,
      }
    }

    // Format output as tree-like structure
    const dirs = entries.filter(e => e.type === 'dir')
    const files = entries.filter(e => e.type === 'file')

    let output = `Directory: ${path}\n`
    output += `${dirs.length} directories, ${files.length} files\n\n`

    // Group by directory
    const grouped = new Map<string, FileEntry[]>()
    for (const entry of entries) {
      const dir = entry.path.includes('/') ? entry.path.split('/').slice(0, -1).join('/') : '.'
      if (!grouped.has(dir)) grouped.set(dir, [])
      grouped.get(dir)!.push(entry)
    }

    for (const [dir, items] of grouped) {
      if (dir !== '.') output += `\n${dir}/\n`
      for (const item of items) {
        const prefix = item.type === 'dir' ? '📁 ' : '   '
        const size = item.size ? ` (${formatSize(item.size)})` : ''
        const name = item.path.split('/').pop() || item.name
        output += `${prefix}${name}${size}\n`
      }
    }

    return {
      success: true,
      summary: `${files.length} files, ${dirs.length} dirs`,
      fullResult: output,
    }
  },
})
