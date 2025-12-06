/**
 * API Keys Utility
 *
 * Centralized access to API keys with validation.
 */

export type ApiKeyName = 'OPENROUTER_API_KEY' | 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY'

/**
 * Get an API key from environment, returning null if not set
 */
export function getApiKey(name: ApiKeyName): string | null {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}

/**
 * Get an API key, throwing if not set
 */
export function requireApiKey(name: ApiKeyName): string {
  const value = getApiKey(name)
  if (!value) {
    throw new Error(`${name} environment variable is not set`)
  }
  return value
}

/**
 * Check if an API key is available
 */
export function hasApiKey(name: ApiKeyName): boolean {
  return getApiKey(name) !== null
}

/**
 * Get the OpenRouter API key (most commonly used)
 */
export function getOpenRouterKey(): string | null {
  return getApiKey('OPENROUTER_API_KEY')
}

/**
 * Require the OpenRouter API key
 */
export function requireOpenRouterKey(): string {
  return requireApiKey('OPENROUTER_API_KEY')
}

/**
 * Result type for operations that need an API key
 */
export type ApiKeyResult<T> = {
  success: true
  data: T
} | {
  success: false
  error: string
}

/**
 * Execute a function that requires an API key, handling missing key gracefully
 */
export async function withApiKey<T>(
  keyName: ApiKeyName,
  fn: (apiKey: string) => Promise<T>
): Promise<ApiKeyResult<T>> {
  const apiKey = getApiKey(keyName)
  if (!apiKey) {
    return {
      success: false,
      error: `${keyName} not set`,
    }
  }

  try {
    const data = await fn(apiKey)
    return { success: true, data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
