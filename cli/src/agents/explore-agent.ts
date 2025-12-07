/**
 * Explore Agent - Directory Structure Analysis
 *
 * Uses generator-based handleSteps pattern.
 * Explores directories and provides intelligent analysis of the structure.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const exploreParams = z.object({
  path: z.string().describe('Directory path to explore'),
  depth: z.number().optional().default(3).describe('Max depth to traverse'),
  showHidden: z.boolean().optional().default(false).describe('Include hidden files'),
  prompt: z.string().optional().describe('What to focus on or analyze'),
})

export const exploreAgent = defineGeneratorAgent({
  name: 'explore',
  id: 'explore',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Explores directory structure and describes what it finds',

  spawnerPrompt:
    'Explores a directory structure and provides intelligent analysis. Use when you need to understand project layout, find files, or map a codebase.',

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'What to focus on or look for in the directory structure',
    },
    params: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to explore' },
        depth: { type: 'number', description: 'Max depth to traverse (default 3)' },
        showHidden: { type: 'boolean', description: 'Include hidden files' },
      },
      required: ['path'],
    },
  },

  outputMode: 'last_message',
  toolNames: ['explore'],

  systemPrompt: `You are an expert at analyzing directory structures and codebases.

Your job is to:
1. Review the directory tree output
2. Identify key patterns, project type, and structure
3. Provide a clear, concise description based on what the user asked

When describing directory structure:
- Identify the project type (e.g., Node.js, Python, Rust, etc.)
- Highlight important directories and files
- Note any patterns or conventions used
- If the user asked about something specific, focus on that
- Be concise but thorough`,

  instructionsPrompt: `Explore the directory and describe what you find based on the user's request.

Focus on providing actionable insights about the structure.`,

  parameters: exploreParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    const { path, depth, showHidden } = params as z.infer<typeof exploreParams>

    if (!path) {
      return
    }

    // Step 1: Explore the directory
    yield {
      toolName: 'explore',
      input: {
        path,
        depth: depth ?? 3,
        showHidden: showHidden ?? false,
      },
    }

    // Step 2: Let the LLM analyze and describe the structure
    yield 'STEP'
  },
})
