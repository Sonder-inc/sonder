/**
 * Sonder Backend API Client
 * Handles authentication, chat proxy, and user operations
 */

const API_BASE = process.env.SONDER_API_URL || 'https://api.sonder.dev'

export interface DeviceAuthResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface PollResponse {
  status?: 'pending'
  interval?: number
  sessionToken?: string
  user?: SonderUser
  error?: string
  error_description?: string
}

export interface SonderUser {
  id: string
  githubId: number
  githubUsername: string
  email?: string
  avatarUrl?: string
  credits: number
  tier: 'free' | 'pro' | 'max' | 'black'
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export interface UsageRecord {
  id: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  createdAt: string
}

export interface TransactionRecord {
  id: string
  type: 'purchase' | 'usage' | 'contribution' | 'refund' | 'subscription'
  amount: number
  description?: string
  createdAt: string
}

interface ErrorResponse {
  error?: string
  error_description?: string
}

/**
 * Sonder API client
 */
export const sonderApi = {
  /**
   * Start GitHub device authorization flow
   */
  async startDeviceAuth(): Promise<DeviceAuthResponse> {
    const response = await fetch(`${API_BASE}/auth/device/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as ErrorResponse
      throw new Error(error.error || 'Failed to start device auth')
    }

    return response.json() as Promise<DeviceAuthResponse>
  },

  /**
   * Poll for device authorization status
   */
  async pollDeviceAuth(deviceCode: string): Promise<PollResponse> {
    const response = await fetch(`${API_BASE}/auth/device/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceCode }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as ErrorResponse
      return { error: error.error, error_description: error.error_description }
    }

    return response.json() as Promise<PollResponse>
  },

  /**
   * Get current authenticated user
   */
  async getMe(sessionToken: string): Promise<{ user: SonderUser }> {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as ErrorResponse
      throw new Error(error.error || 'Failed to get user')
    }

    return response.json() as Promise<{ user: SonderUser }>
  },

  /**
   * Logout - invalidate session
   */
  async logout(sessionToken: string): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
  },

  /**
   * Chat completions (AI proxy)
   * Returns a Response for streaming support
   */
  async chatCompletions(sessionToken: string, body: ChatRequest): Promise<Response> {
    return fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  },

  /**
   * Get current credit balance
   */
  async getCredits(sessionToken: string): Promise<{ credits: number; tier: string }> {
    const response = await fetch(`${API_BASE}/user/credits`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as ErrorResponse
      throw new Error(error.error || 'Failed to get credits')
    }

    return response.json() as Promise<{ credits: number; tier: string }>
  },

  /**
   * Get usage history
   */
  async getUsage(sessionToken: string, limit = 50, offset = 0): Promise<{ usage: UsageRecord[] }> {
    const response = await fetch(
      `${API_BASE}/user/usage?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as ErrorResponse
      throw new Error(error.error || 'Failed to get usage')
    }

    return response.json() as Promise<{ usage: UsageRecord[] }>
  },

  /**
   * Get transaction history
   */
  async getTransactions(sessionToken: string, limit = 50, offset = 0): Promise<{ transactions: TransactionRecord[] }> {
    const response = await fetch(
      `${API_BASE}/user/transactions?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as ErrorResponse
      throw new Error(error.error || 'Failed to get transactions')
    }

    return response.json() as Promise<{ transactions: TransactionRecord[] }>
  },
}

export default sonderApi
