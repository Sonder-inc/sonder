/**
 * Services Module
 *
 * Core services for LLM interaction, persistence, and external APIs.
 */

// LLM Services
export { streamChat, generateConversationSummary, getSmartShortcut } from './openrouter'
export { executeAgentLLM } from './agent-executor'
export type { AgentExecutorConfig, AgentExecutorResult } from './agent-executor'
export { parseToolOutput, createErrorResult, buildItemSummary } from './agent-parser'
export type { ParseToolOutputOptions, ParseResult } from './agent-parser'

// Persistence
export {
  saveMessage,
  loadMessage,
  loadMessages,
  deleteMessage,
  getThreadMessages,
  MESSAGES_DIR,
} from './message-persistence'

export {
  saveThread,
  loadThread,
  deleteThread,
} from './thread-persistence'

// Platform & Support
export { collectFingerprint, formatFingerprint } from './fingerprint'
export type { SystemFingerprint } from './fingerprint'
export { createSupportTicket, createSupportTicketApi, triggerAutoPR } from './support'
export type { SupportTicket, SupportResult } from './support'

// MCP
export { mcpManager } from './mcp-manager'
export type {
  MCPToolDefinition,
  MCPToolCallResult,
  MCPServerCapabilities,
  MCPInitializeResult,
  AvailableMCPTool,
} from './mcp-types'
