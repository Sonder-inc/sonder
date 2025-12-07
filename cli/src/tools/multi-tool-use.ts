/**
 * Multi Tool Use - Parallel Execution
 *
 * Executes multiple tools in parallel and returns combined results.
 */

import { z } from 'zod'
import { defineTool, type ToolResult } from './types'
import { toolRegistry } from './registry'

const toolCallSchema = z.object({
  tool_name: z.string().describe('Name of the tool to call'),
  parameters: z.record(z.unknown()).describe('Parameters to pass to the tool'),
})

const multiToolUseParams = z.object({
  tool_uses: z.array(toolCallSchema).min(1).max(10).describe('Array of tool calls to execute in parallel'),
})

export const multiToolUseParallel = defineTool({
  name: 'multi_tool_use_parallel',
  description: `Execute multiple tools in parallel. Use this when you need to run several independent operations concurrently for efficiency.

Example:
{
  "tool_uses": [
    { "tool_name": "commander", "parameters": { "command": "nmap -sV target", "prompt": "list open ports" } },
    { "tool_name": "explore", "parameters": { "path": "/var/www" } }
  ]
}`,
  parameters: multiToolUseParams,

  async execute({ tool_uses }): Promise<ToolResult> {
    const startTime = Date.now()

    // Execute all tools in parallel
    const results = await Promise.all(
      tool_uses.map(async ({ tool_name, parameters }) => {
        try {
          const result = await toolRegistry.execute(tool_name, parameters)
          return {
            tool_name,
            success: result.success,
            summary: result.summary,
            fullResult: result.fullResult,
          }
        } catch (error) {
          return {
            tool_name,
            success: false,
            summary: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            fullResult: error instanceof Error ? error.stack || error.message : 'Unknown error',
          }
        }
      })
    )

    const duration = Date.now() - startTime
    const succeeded = results.filter(r => r.success).length
    const failed = results.length - succeeded

    // Build combined output
    const outputParts: string[] = []
    for (const result of results) {
      const status = result.success ? '✓' : '✗'
      outputParts.push(`=== ${status} ${result.tool_name} ===`)
      outputParts.push(result.fullResult)
      outputParts.push('')
    }

    outputParts.push(`Completed: ${succeeded}/${results.length} succeeded in ${duration}ms`)

    return {
      success: failed === 0,
      summary: `${succeeded}/${results.length} tools succeeded`,
      fullResult: outputParts.join('\n'),
      displayName: 'Parallel',
      displayInput: tool_uses.map(t => t.tool_name).join(', '),
      displayColor: failed === 0 ? 'success' : failed === results.length ? 'error' : 'default',
    }
  },
})
