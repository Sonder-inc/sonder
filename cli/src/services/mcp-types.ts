/**
 * MCP (Model Context Protocol) Types
 * Based on MCP specification 2024-11-05
 */

// =============================================================================
// JSON-RPC 2.0 Base Types
// =============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: JsonRpcError
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

// =============================================================================
// MCP Initialize Types
// =============================================================================

export interface MCPClientInfo {
  name: string
  version: string
}

export interface MCPServerInfo {
  name: string
  version: string
}

export interface MCPServerCapabilities {
  tools?: Record<string, never> // Empty object indicates support
  resources?: Record<string, never>
  prompts?: Record<string, never>
  logging?: Record<string, never>
}

export interface MCPInitializeParams {
  protocolVersion: string
  capabilities: Record<string, never>
  clientInfo: MCPClientInfo
}

export interface MCPInitializeResult {
  protocolVersion: string
  capabilities: MCPServerCapabilities
  serverInfo: MCPServerInfo
}

// =============================================================================
// MCP Tool Types
// =============================================================================

export interface MCPToolInputSchema {
  type: 'object'
  properties?: Record<
    string,
    {
      type: string
      description?: string
      enum?: string[]
      default?: unknown
    }
  >
  required?: string[]
}

export interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema: MCPToolInputSchema
}

export interface MCPToolsListResult {
  tools: MCPToolDefinition[]
}

export interface MCPToolCallParams {
  name: string
  arguments?: Record<string, unknown>
}

export interface MCPToolCallContentText {
  type: 'text'
  text: string
}

export interface MCPToolCallContentImage {
  type: 'image'
  data: string
  mimeType: string
}

export interface MCPToolCallContentResource {
  type: 'resource'
  resource: {
    uri: string
    mimeType?: string
    text?: string
    blob?: string
  }
}

export type MCPToolCallContent =
  | MCPToolCallContentText
  | MCPToolCallContentImage
  | MCPToolCallContentResource

export interface MCPToolCallResult {
  content: MCPToolCallContent[]
  isError?: boolean
}

// =============================================================================
// MCP Resource Types (for future use)
// =============================================================================

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPResourcesListResult {
  resources: MCPResource[]
}

// =============================================================================
// Internal Types for MCP Manager
// =============================================================================

export interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export interface AvailableMCPTool {
  server: string
  tool: MCPToolDefinition
}
