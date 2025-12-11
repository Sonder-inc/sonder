import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { db, users, sessions, usage, transactions } from '../db'

export const userRoutes = new Hono()

// Auth middleware helper
async function getAuthenticatedUser(c: any) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const sessionToken = authHeader.slice(7)
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionToken))
    .limit(1)

  if (!session || new Date() > session.expiresAt) {
    return null
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)

  return user
}

/**
 * GET /user/credits
 * Get current credit balance and tier
 */
userRoutes.get('/credits', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({
    credits: user.credits,
    tier: user.tier,
  })
})

/**
 * GET /user/usage
 * Get usage history
 */
userRoutes.get('/usage', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  const usageRecords = await db
    .select()
    .from(usage)
    .where(eq(usage.userId, user.id))
    .orderBy(desc(usage.createdAt))
    .limit(limit)
    .offset(offset)

  return c.json({
    usage: usageRecords.map(r => ({
      id: r.id,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cost: r.cost,
      createdAt: r.createdAt,
    })),
  })
})

/**
 * GET /user/transactions
 * Get transaction history
 */
userRoutes.get('/transactions', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  const txRecords = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, user.id))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset)

  return c.json({
    transactions: txRecords.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      createdAt: t.createdAt,
    })),
  })
})

/**
 * POST /user/purchase
 * Create Stripe checkout session for credits
 * TODO: Implement with Stripe
 */
userRoutes.post('/purchase', async (c) => {
  const user = await getAuthenticatedUser(c)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // TODO: Create Stripe checkout session
  return c.json({ error: 'Not implemented yet' }, 501)
})
