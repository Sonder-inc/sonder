import { z } from 'zod'
import { defineAgent, type AgentResult, type AgentContext } from './types'
import { executeAgentLLM } from '../services/agent-executor'
import { mcpManager } from '../services/mcp-manager'
import type { MCPToolCallResult } from '../services/mcp-types'

const MCP_SYSTEM_PROMPT = `You are the MCP (Model Context Protocol) routing agent. You have access to tools from external MCP servers.

Your job is to:
1. Understand what the user wants to accomplish
2. Select the appropriate MCP tool to call
3. Provide the correct arguments for that tool

You will be given a list of available MCP tools with their servers, names, and descriptions.

IMPORTANT: Output ONLY valid JSON, nothing else. No explanations or markdown.

Output format for calling a tool:
{
  "action": "call_tool",
  "server": "server-name",
  "tool": "tool-name",
  "args": { "param1": "value1" }
}

If you need to list available tools instead:
{
  "action": "list_tools"
}

If no suitable tool exists:
{
  "action": "none",
  "reason": "explanation"
}`

const mcpParams = z.object({
  task: z.string().describe('What to do with MCP tools'),
  preferredServer: z.string().optional().describe('Preferred MCP server to use'),
})

type MCPParams = z.infer<typeof mcpParams>

export interface MCPAgentResult {
  action: 'list_tools' | 'call_tool' | 'none'
  tools?: Array<{ server: string; name: string; description?: string }>
  toolResult?: {
    server: string
    tool: string
    content: string
    isError?: boolean
  }
  error?: string
  reason?: string
}

/**
 * Format MCP tool call result content for display
 */
function formatToolResult(result: MCPToolCallResult): string {
  if (!result.content || result.content.length === 0) {
    return '(empty result)'
  }

  return result.content
    .map(item => {
      if (item.type === 'text') {
        return item.text || ''
      }
      if (item.type === 'image') {
        return `[Image: ${item.mimeType || 'unknown type'}]`
      }
      if (item.type === 'resource') {
        const res = item.resource
        if (res.text) return res.text
        return `[Resource: ${res.uri}]`
      }
      return '[Unknown content type]'
    })
    .join('\n')
}

export const mcpAgent = defineAgent<typeof mcpParams, MCPAgentResult>({
  name: 'mcp',
  description:
    'Access tools from MCP servers (filesystem, databases, APIs). Lists available tools and calls them.',
  systemPrompt: MCP_SYSTEM_PROMPT,
  parameters: mcpParams,

  async execute(
    params: MCPParams,
    context: AgentContext
  ): Promise<AgentResult<MCPAgentResult>> {
    // Get available tools from all running MCP servers
    const availableTools = mcpManager.getAvailableTools()

    if (availableTools.length === 0) {
      const runningServers = mcpManager.getRunning()
      const status = mcpManager.getStatus()

      let errorMsg = 'No MCP tools available.'
      if (runningServers.length === 0) {
        const configured = status.length
        if (configured === 0) {
          errorMsg += ' No MCP servers configured. Add servers to ~/.sonder/mcps/'
        } else {
          const errors = status.filter(s => s.status === 'error')
          if (errors.length > 0) {
            errorMsg += ` ${errors.length} server(s) failed: ${errors.map(e => `${e.name}: ${e.error}`).join(', ')}`
          } else {
            errorMsg += ' Configured servers are not running.'
          }
        }
      }

      return {
        success: false,
        summary: errorMsg,
        data: { action: 'none', error: errorMsg },
      }
    }

    // Build tool list for LLM context
    const toolListStr = availableTools
      .map(t => {
        const schema = t.tool.inputSchema
        const params = schema.properties
          ? Object.entries(schema.properties)
              .map(([name, prop]) => {
                const p = prop as { type: string; description?: string }
                const required = schema.required?.includes(name) ? '*' : ''
                return `    - ${name}${required}: ${p.type}${p.description ? ` (${p.description})` : ''}`
              })
              .join('\n')
          : '    (no parameters)'
        return `- ${t.server}/${t.tool.name}: ${t.tool.description || 'No description'}\n${params}`
      })
      .join('\n\n')

    const userPrompt = `Available MCP tools:\n\n${toolListStr}\n\n---\n\nTask: ${params.task}${
      params.preferredServer ? `\n\nPreferred server: ${params.preferredServer}` : ''
    }`

    // Call LLM to decide what to do
    const result = await executeAgentLLM({
      name: 'mcp',
      systemPrompt: MCP_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: `MCP agent LLM failed: ${result.error}`,
        data: { action: 'none', error: result.error },
      }
    }

    // Parse LLM decision
    let decision: {
      action: 'list_tools' | 'call_tool' | 'none'
      server?: string
      tool?: string
      args?: Record<string, unknown>
      reason?: string
    }

    try {
      // Extract JSON from response (handle potential markdown wrapping)
      let jsonStr = result.text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      decision = JSON.parse(jsonStr.trim())
    } catch {
      return {
        success: false,
        summary: 'Failed to parse MCP agent decision',
        data: { action: 'none', error: `Invalid JSON: ${result.text.slice(0, 100)}` },
      }
    }

    // Handle list_tools action
    if (decision.action === 'list_tools') {
      return {
        success: true,
        summary: `${availableTools.length} MCP tools available`,
        data: {
          action: 'list_tools',
          tools: availableTools.map(t => ({
            server: t.server,
            name: t.tool.name,
            description: t.tool.description,
          })),
        },
      }
    }

    // Handle no suitable tool
    if (decision.action === 'none') {
      return {
        success: true,
        summary: decision.reason || 'No suitable MCP tool found',
        data: { action: 'none', reason: decision.reason },
      }
    }

    // Handle call_tool action
    if (decision.action === 'call_tool') {
      if (!decision.server || !decision.tool) {
        return {
          success: false,
          summary: 'Invalid tool call: missing server or tool name',
          data: { action: 'none', error: 'Missing server or tool name' },
        }
      }

      // Verify the tool exists
      const targetTool = availableTools.find(
        t => t.server === decision.server && t.tool.name === decision.tool
      )
      if (!targetTool) {
        return {
          success: false,
          summary: `Tool not found: ${decision.server}/${decision.tool}`,
          data: {
            action: 'none',
            error: `Tool ${decision.server}/${decision.tool} not found`,
          },
        }
      }

      try {
        const toolResult = await mcpManager.callTool(
          decision.server,
          decision.tool,
          decision.args || {}
        )

        const content = formatToolResult(toolResult)
        const isError = toolResult.isError === true

        return {
          success: !isError,
          summary: isError
            ? `${decision.server}/${decision.tool} returned error`
            : `Called ${decision.server}/${decision.tool}`,
          data: {
            action: 'call_tool',
            toolResult: {
              server: decision.server,
              tool: decision.tool,
              content,
              isError,
            },
          },
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          summary: `MCP tool call failed: ${errorMsg}`,
          data: {
            action: 'call_tool',
            error: errorMsg,
            toolResult: {
              server: decision.server,
              tool: decision.tool,
              content: errorMsg,
              isError: true,
            },
          },
        }
      }
    }

    // Unknown action
    return {
      success: false,
      summary: `Unknown MCP action: ${decision.action}`,
      data: { action: 'none', error: `Unknown action: ${decision.action}` },
    }
  },
})
