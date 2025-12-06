/**
 * Utilities Module
 *
 * Shared utility functions used across the codebase.
 */

// Process execution
export { executeProcess, getTimeoutForScanType } from './process-executor'
export type { ProcessResult, ProcessOptions } from './process-executor'

// Wordlist detection
export { findWordlist, findWordlistFromPaths, hasWordlistsAvailable, WORDLISTS } from './wordlist-finder'
export type { WordlistType } from './wordlist-finder'

// API keys
export { getApiKey, requireApiKey, hasApiKey, getOpenRouterKey, requireOpenRouterKey, withApiKey } from './api-keys'
export type { ApiKeyName, ApiKeyResult } from './api-keys'

// Configuration
export { loadConfig, saveConfig, initUserConfig, SONDER_HOME, USER_DIRS } from './user-config'
export type { SonderConfig, ApiKeysConfig } from './user-config'

// User-defined extensions
export { loadUserTools, loadUserAgents } from './user-loader'

// Token estimation
export { estimateTokens, formatTokens, calculateMessageTokens } from './tokens'

// Search/autocomplete
export { searchCommands, searchContext } from './trie'

// Text utilities
export {
  insertText,
  deleteRange,
  expandTabs,
  TAB_WIDTH,
  CONTROL_CHAR_REGEX,
  preventKeyDefault,
} from './text-editing'

export {
  findLineStart,
  findLineEnd,
  findPreviousWordBoundary,
  findNextWordBoundary,
} from './text-navigation'

// Updates
export { checkForUpdates, performUpdate } from './updater'

// Initialization
export { initSonder, getInitSummary } from './init'
export type { InitResult } from './init'
