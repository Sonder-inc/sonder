import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '../lib/constants'

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

export interface GitHubUser {
  id: number
  login: string
  avatar_url: string
  email: string | null
  name: string | null
}

/**
 * Start the GitHub device authorization flow
 */
export async function startDeviceAuth(): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user user:email',
    }),
  })

  if (!response.ok) {
    throw new Error(`GitHub device code request failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Poll for access token after user authorizes
 */
export async function pollForToken(deviceCode: string): Promise<TokenResponse> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  })

  if (!response.ok) {
    throw new Error(`GitHub token request failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Get GitHub user profile from access token
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub user request failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Get user's primary email if not public
 */
export async function getGitHubUserEmail(accessToken: string): Promise<string | null> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return null
  }

  const emails = await response.json() as Array<{ email: string; primary: boolean; verified: boolean }>
  const primary = emails.find(e => e.primary && e.verified)
  return primary?.email || emails[0]?.email || null
}
