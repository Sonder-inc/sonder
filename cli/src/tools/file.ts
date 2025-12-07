/**
 * File Tools - Read, Write, Patch
 *
 * Direct file operations for the main agent.
 * Extracted from editor-agent to be first-class tools.
 */

import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { readFile as fsReadFile, writeFile as fsWriteFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

// =============================================================================
// Read File
// =============================================================================

const readFileParams = z.object({
  path: z.string().describe('Absolute or relative file path to read'),
})

export const Read = defineTool({
  name: 'Read',
  description: 'Read the contents of a file. Returns numbered lines for easy reference.',
  parameters: readFileParams,

  async execute({ path }): Promise<ToolResult> {
    try {
      const content = await fsReadFile(path, 'utf-8')
      const lines = content.split('\n')
      const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join('\n')

      return {
        success: true,
        summary: `Read ${lines.length} lines`,
        fullResult: numbered,
        displayName: 'Read',
        displayInput: path,
        displayColor: 'success',
      }
    } catch (err) {
      return {
        success: false,
        summary: err instanceof Error ? err.message : 'Failed to read file',
        fullResult: err instanceof Error ? err.message : String(err),
        displayName: 'Read',
        displayInput: path,
        displayColor: 'error',
      }
    }
  },
})

// =============================================================================
// Write File
// =============================================================================

const writeFileParams = z.object({
  path: z.string().describe('File path to write to (creates parent directories if needed)'),
  content: z.string().describe('Content to write to the file'),
})

export const Write = defineTool({
  name: 'Write',
  description: 'Write content to a file. Creates the file and parent directories if they don\'t exist. Overwrites existing files.',
  parameters: writeFileParams,

  async execute({ path, content }): Promise<ToolResult> {
    try {
      await mkdir(dirname(path), { recursive: true })
      await fsWriteFile(path, content, 'utf-8')
      const lines = content.split('\n').length

      return {
        success: true,
        summary: `Wrote ${lines} lines`,
        fullResult: `Successfully wrote ${lines} lines to ${path}`,
        displayName: 'Write',
        displayInput: path,
        displayColor: 'success',
      }
    } catch (err) {
      return {
        success: false,
        summary: err instanceof Error ? err.message : 'Failed to write file',
        fullResult: err instanceof Error ? err.message : String(err),
        displayName: 'Write',
        displayInput: path,
        displayColor: 'error',
      }
    }
  },
})

// =============================================================================
// Patch File
// =============================================================================

const patchFileParams = z.object({
  path: z.string().describe('File path to patch'),
  search: z.string().describe('Exact text to find and replace'),
  replace: z.string().describe('Text to replace the search text with'),
  replaceAll: z.boolean().optional().default(false).describe('Replace all occurrences (default: first only)'),
})

export const Edit = defineTool({
  name: 'Edit',
  description: 'Replace text in a file. Finds exact match of search text and replaces it. Use for surgical edits.',
  parameters: patchFileParams,

  async execute({ path, search, replace, replaceAll }): Promise<ToolResult> {
    try {
      const original = await fsReadFile(path, 'utf-8')

      if (!original.includes(search)) {
        return {
          success: false,
          summary: 'Search text not found',
          fullResult: `Could not find the search text in ${path}:\n\n${search}`,
          displayName: 'Patch',
          displayInput: path,
          displayColor: 'error',
        }
      }

      const patched = replaceAll
        ? original.split(search).join(replace)
        : original.replace(search, replace)

      const occurrences = original.split(search).length - 1
      const replaced = replaceAll ? occurrences : 1

      await fsWriteFile(path, patched, 'utf-8')

      return {
        success: true,
        summary: `Replaced ${replaced} occurrence${replaced > 1 ? 's' : ''}`,
        fullResult: `Patched ${path}: replaced ${replaced} of ${occurrences} occurrence${occurrences > 1 ? 's' : ''}`,
        displayName: 'Patch',
        displayInput: path,
        displayColor: 'success',
      }
    } catch (err) {
      return {
        success: false,
        summary: err instanceof Error ? err.message : 'Failed to patch file',
        fullResult: err instanceof Error ? err.message : String(err),
        displayName: 'Patch',
        displayInput: path,
        displayColor: 'error',
      }
    }
  },
})
