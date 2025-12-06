import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

const EXPLORER_SYSTEM_PROMPT = `You are a codebase exploration agent. Your job is to navigate and understand project structures.

Given a directory listing or file contents, you:
1. Identify the project type (Node.js, Python, Go, etc.)
2. Find key entry points and configuration files
3. Map out the architecture and dependencies
4. Identify relevant files for a given task

Output format (JSON):
{
  "projectType": "string",
  "entryPoints": ["file1", "file2"],
  "relevantFiles": ["file1", "file2"],
  "structure": "brief description of architecture",
  "suggestions": ["what to explore next"]
}

Only output JSON, nothing else.`

const explorerParams = z.object({
  goal: z.string().describe('What are we looking for or trying to understand'),
  fileTree: z.string().optional().describe('Directory listing or file tree'),
  fileContents: z.record(z.string()).optional().describe('Map of filename to contents'),
})

type ExplorerParams = z.infer<typeof explorerParams>

export interface ExplorerResult {
  projectType: string
  entryPoints: string[]
  relevantFiles: string[]
  structure: string
  suggestions: string[]
}

export const explorerAgent = defineAgent<typeof explorerParams, ExplorerResult>({
  name: 'explorer',
  description: 'Explore and understand codebase structure. Identifies project type, entry points, and relevant files.',
  systemPrompt: EXPLORER_SYSTEM_PROMPT,
  parameters: explorerParams,

  async execute(params: ExplorerParams, context): Promise<AgentResult<ExplorerResult>> {
    let userPrompt = `Goal: ${params.goal}`

    if (params.fileTree) {
      userPrompt += `\n\nDirectory structure:\n${params.fileTree}`
    }

    if (params.fileContents) {
      userPrompt += '\n\nFile contents:'
      for (const [file, content] of Object.entries(params.fileContents)) {
        const truncated = content.length > 1000 ? content.slice(0, 1000) + '...' : content
        userPrompt += `\n\n--- ${file} ---\n${truncated}`
      }
    }

    const result = await executeAgentLLM({
      name: 'explorer',
      systemPrompt: EXPLORER_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Exploration failed',
        data: {
          projectType: 'unknown',
          entryPoints: [],
          relevantFiles: [],
          structure: '',
          suggestions: [],
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as ExplorerResult

      return {
        success: true,
        summary: `${data.projectType} project, ${data.relevantFiles.length} relevant files`,
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse exploration result',
        data: {
          projectType: 'unknown',
          entryPoints: [],
          relevantFiles: [],
          structure: result.text,
          suggestions: [],
        },
      }
    }
  },
})
