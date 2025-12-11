import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { db, users, sessions, deviceCodes } from '../db'
import { startDeviceAuth, pollForToken, getGitHubUser, getGitHubUserEmail } from '../services/github'
import { SESSION_EXPIRY_DAYS } from '../lib/constants'

export const authRoutes = new Hono()

/**
 * POST /auth/device/start
 * Start the GitHub device authorization flow
 */
authRoutes.post('/device/start', async (c) => {
  try {
    // Start GitHub device flow
    const githubResponse = await startDeviceAuth()

    // Generate our own device code for the client to poll
    const deviceCode = nanoid(32)
    const userCode = githubResponse.user_code

    // Store the mapping
    await db.insert(deviceCodes).values({
      deviceCode,
      userCode,
      githubDeviceCode: githubResponse.device_code,
      interval: githubResponse.interval,
      expiresAt: new Date(Date.now() + githubResponse.expires_in * 1000),
    })

    return c.json({
      deviceCode,
      userCode,
      verificationUri: githubResponse.verification_uri,
      expiresIn: githubResponse.expires_in,
      interval: githubResponse.interval,
    })
  } catch (error) {
    console.error('Device auth start error:', error)
    return c.json({ error: 'Failed to start device authorization' }, 500)
  }
})

/**
 * POST /auth/device/poll
 * Poll for authorization status
 */
authRoutes.post('/device/poll', async (c) => {
  const body = await c.req.json<{ deviceCode: string }>()
  const { deviceCode } = body

  if (!deviceCode) {
    return c.json({ error: 'Device code required' }, 400)
  }

  // Get stored device code
  const [storedCode] = await db
    .select()
    .from(deviceCodes)
    .where(eq(deviceCodes.deviceCode, deviceCode))
    .limit(1)

  if (!storedCode) {
    return c.json({ error: 'Invalid device code' }, 400)
  }

  // Check expiry
  if (new Date() > storedCode.expiresAt) {
    await db.delete(deviceCodes).where(eq(deviceCodes.deviceCode, deviceCode))
    return c.json({ error: 'expired_token', error_description: 'Device code expired' }, 400)
  }

  // If we already have an access token, user already authorized
  if (storedCode.accessToken) {
    // Create/get user and session
    const result = await createUserAndSession(storedCode.accessToken)

    // Clean up device code
    await db.delete(deviceCodes).where(eq(deviceCodes.deviceCode, deviceCode))

    return c.json(result)
  }

  // Poll GitHub for token
  try {
    const tokenResponse = await pollForToken(storedCode.githubDeviceCode)

    if (tokenResponse.error) {
      // Still waiting for user to authorize
      if (tokenResponse.error === 'authorization_pending') {
        return c.json({ status: 'pending' })
      }
      // User needs to slow down
      if (tokenResponse.error === 'slow_down') {
        return c.json({ status: 'pending', interval: storedCode.interval + 5 })
      }
      // User denied or code expired
      if (tokenResponse.error === 'access_denied' || tokenResponse.error === 'expired_token') {
        await db.delete(deviceCodes).where(eq(deviceCodes.deviceCode, deviceCode))
        return c.json({ error: tokenResponse.error, error_description: tokenResponse.error_description }, 400)
      }
      return c.json({ error: tokenResponse.error }, 400)
    }

    // Success! Store the token
    if (tokenResponse.access_token) {
      await db
        .update(deviceCodes)
        .set({ accessToken: tokenResponse.access_token })
        .where(eq(deviceCodes.deviceCode, deviceCode))

      // Create/get user and session
      const result = await createUserAndSession(tokenResponse.access_token)

      // Clean up device code
      await db.delete(deviceCodes).where(eq(deviceCodes.deviceCode, deviceCode))

      return c.json(result)
    }

    return c.json({ status: 'pending' })
  } catch (error) {
    console.error('Device poll error:', error)
    return c.json({ status: 'pending' })
  }
})

/**
 * GET /auth/me
 * Get current user profile
 */
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionToken = authHeader.slice(7)

  // Get session
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionToken))
    .limit(1)

  if (!session) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  // Check expiry
  if (new Date() > session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.id, sessionToken))
    return c.json({ error: 'Session expired' }, 401)
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    user: {
      id: user.id,
      githubId: user.githubId,
      githubUsername: user.githubUsername,
      email: user.email,
      avatarUrl: user.avatarUrl,
      credits: user.credits,
      tier: user.tier,
    },
  })
})

/**
 * POST /auth/logout
 * Invalidate session
 */
authRoutes.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const sessionToken = authHeader.slice(7)
    await db.delete(sessions).where(eq(sessions.id, sessionToken))
  }
  return c.json({ success: true })
})

/**
 * Helper: Create or get user and create session
 */
async function createUserAndSession(accessToken: string) {
  // Get GitHub user
  const githubUser = await getGitHubUser(accessToken)
  let email = githubUser.email

  // Try to get email if not public
  if (!email) {
    email = await getGitHubUserEmail(accessToken)
  }

  // Check if user exists
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.githubId, githubUser.id))
    .limit(1)

  if (!user) {
    // Create new user
    const userId = nanoid()
    await db.insert(users).values({
      id: userId,
      githubId: githubUser.id,
      githubUsername: githubUser.login,
      email,
      avatarUrl: githubUser.avatar_url,
      credits: 0,
      tier: 'free',
    })

    ;[user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
  } else {
    // Update user info (username/avatar may have changed)
    await db
      .update(users)
      .set({
        githubUsername: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        email: email || user.email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
  }

  // Create session
  const sessionToken = nanoid(32)
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(sessions).values({
    id: sessionToken,
    userId: user.id,
    expiresAt,
  })

  return {
    sessionToken,
    user: {
      id: user.id,
      githubId: user.githubId,
      githubUsername: githubUser.login,
      email: email || user.email,
      avatarUrl: githubUser.avatar_url,
      credits: user.credits,
      tier: user.tier,
    },
  }
}
