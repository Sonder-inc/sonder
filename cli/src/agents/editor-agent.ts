/**
 * Editor Agent - File Editing
 *
 * Handles file read/write/patch operations.
 */

import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const editorParams = z.object({
  action: z.enum(['read', 'write', 'patch']).describe('Action to perform'),
  path: z.string().describe('File path'),
  content: z.string().optional().describe('Content to write or patch replacement'),
  search: z.string().optional().describe('Text to find (for patch)'),
})

type EditorParams = z.infer<typeof editorParams>

export interface EditorResult {
  action: 'read' | 'write' | 'patch'
  path: string
  content?: string
  linesChanged?: number
}

export const editorAgent = defineAgent<typeof editorParams, EditorResult>({
  name: 'editor',
  description: 'Read, write, and patch files. Handles file operations.',
  systemPrompt: '',
  parameters: editorParams,

  async execute(params: EditorParams): Promise<AgentResult<EditorResult>> {
    try {
      switch (params.action) {
        case 'read': {
          const content = await readFile(params.path, 'utf-8')
          const lines = content.split('\n')
          const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join('\n')
          return {
            success: true,
            summary: `Read ${lines.length} lines`,
            data: { action: 'read', path: params.path, content: numbered },
          }
        }

        case 'write': {
          if (!params.content) {
            return { success: false, summary: 'No content provided', data: { action: 'write', path: params.path } }
          }
          await mkdir(dirname(params.path), { recursive: true })
          await writeFile(params.path, params.content, 'utf-8')
          const lines = params.content.split('\n').length
          return {
            success: true,
            summary: `Wrote ${lines} lines`,
            data: { action: 'write', path: params.path, linesChanged: lines },
          }
        }

        case 'patch': {
          if (!params.search || !params.content) {
            return { success: false, summary: 'Search and content required for patch', data: { action: 'patch', path: params.path } }
          }
          const original = await readFile(params.path, 'utf-8')
          if (!original.includes(params.search)) {
            return { success: false, summary: 'Search text not found', data: { action: 'patch', path: params.path } }
          }
          const patched = original.replace(params.search, params.content)
          await writeFile(params.path, patched, 'utf-8')
          return {
            success: true,
            summary: 'Patched successfully',
            data: { action: 'patch', path: params.path, linesChanged: 1 },
          }
        }
      }
    } catch (err) {
      return {
        success: false,
        summary: err instanceof Error ? err.message : String(err),
        data: { action: params.action, path: params.path },
      }
    }
  },
})
