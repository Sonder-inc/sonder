import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const exploreParams = z.object({
  path: z.string().describe('Directory path to explore'),
  depth: z.number().optional().default(3).describe('Max depth to traverse'),
  showHidden: z.boolean().optional().default(false).describe('Include hidden files'),
})

interface FileNode {
  name: string
  type: 'file' | 'directory'
  size?: number
  children?: FileNode[]
}

async function buildTree(
  dirPath: string,
  basePath: string,
  currentDepth: number,
  maxDepth: number,
  showHidden: boolean
): Promise<FileNode[]> {
  if (currentDepth > maxDepth) return []

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const nodes: FileNode[] = []

    for (const entry of entries) {
      // Skip hidden files unless requested
      if (!showHidden && entry.name.startsWith('.')) continue
      // Always skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') continue

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const children = await buildTree(
          fullPath,
          basePath,
          currentDepth + 1,
          maxDepth,
          showHidden
        )
        nodes.push({
          name: entry.name,
          type: 'directory',
          children,
        })
      } else {
        const stats = await stat(fullPath).catch(() => null)
        nodes.push({
          name: entry.name,
          type: 'file',
          size: stats?.size,
        })
      }
    }

    return nodes.sort((a, b) => {
      // Directories first, then alphabetically
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  } catch {
    return []
  }
}

function formatTree(nodes: FileNode[], prefix = ''): string {
  const lines: string[] = []

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const isLast = i === nodes.length - 1
    const connector = isLast ? '└── ' : '├── '
    const childPrefix = isLast ? '    ' : '│   '

    if (node.type === 'directory') {
      lines.push(`${prefix}${connector}${node.name}/`)
      if (node.children?.length) {
        lines.push(formatTree(node.children, prefix + childPrefix))
      }
    } else {
      const size = node.size ? ` (${formatSize(node.size)})` : ''
      lines.push(`${prefix}${connector}${node.name}${size}`)
    }
  }

  return lines.join('\n')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function countNodes(nodes: FileNode[]): { files: number; dirs: number } {
  let files = 0
  let dirs = 0

  for (const node of nodes) {
    if (node.type === 'directory') {
      dirs++
      if (node.children) {
        const sub = countNodes(node.children)
        files += sub.files
        dirs += sub.dirs
      }
    } else {
      files++
    }
  }

  return { files, dirs }
}

export const Glob = defineTool({
  name: 'Glob',
  description: 'Explore directory structure. Returns a tree view of files and folders.',
  parameters: exploreParams,

  async execute(params): Promise<ToolResult> {
    const { path, depth, showHidden } = params

    try {
      const stats = await stat(path)
      if (!stats.isDirectory()) {
        return {
          success: false,
          summary: 'Path is not a directory',
          fullResult: `"${path}" is not a directory`,
        }
      }

      const tree = await buildTree(path, path, 0, depth, showHidden)
      const { files, dirs } = countNodes(tree)
      const treeOutput = formatTree(tree)

      return {
        success: true,
        summary: `${files} files, ${dirs} dirs`,
        fullResult: `${path}\n${treeOutput}`,
        displayInput: path,
      }
    } catch (err) {
      return {
        success: false,
        summary: 'Failed to explore directory',
        fullResult: err instanceof Error ? err.message : String(err),
      }
    }
  },
})
