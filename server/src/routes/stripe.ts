import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { db, users, transactions } from '../db'
import { TIERS } from '../lib/constants'

export const stripeRoutes = new Hono()

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

/**
 * POST /stripe/webhook
 * Handle Stripe webhook events
 */
stripeRoutes.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature')
  const rawBody = await c.req.text()

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook secret not configured')
    return c.json({ error: 'Webhook not configured' }, 500)
  }

  // TODO: Verify webhook signature with Stripe
  // const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)

  // For now, parse directly (INSECURE - add signature verification in production)
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  console.log('Stripe webhook received:', event.type)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // One-time credit purchase completed
        const session = event.data.object
        const userId = session.metadata?.userId
        const credits = parseFloat(session.metadata?.credits || '0')

        if (userId && credits > 0) {
          // Add credits to user
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)

          if (user) {
            await db
              .update(users)
              .set({ credits: user.credits + credits })
              .where(eq(users.id, userId))

            // Record transaction
            await db.insert(transactions).values({
              id: nanoid(),
              userId,
              type: 'purchase',
              amount: credits,
              description: `Purchased ${credits} credits`,
              stripePaymentId: session.payment_intent,
            })
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Subscription created or tier changed
        const subscription = event.data.object
        const stripeCustomerId = subscription.customer

        // Find user by Stripe customer ID
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (user) {
          // Determine tier from price ID
          const priceId = subscription.items.data[0]?.price?.id
          let newTier: 'free' | 'pro' | 'max' | 'black' = 'free'

          for (const [tier, config] of Object.entries(TIERS)) {
            if (config.priceId === priceId) {
              newTier = tier as typeof newTier
              break
            }
          }

          await db
            .update(users)
            .set({ tier: newTier })
            .where(eq(users.id, user.id))
        }
        break
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled
        const subscription = event.data.object
        const stripeCustomerId = subscription.customer

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (user) {
          await db
            .update(users)
            .set({ tier: 'free' })
            .where(eq(users.id, user.id))
        }
        break
      }

      case 'invoice.paid': {
        // Monthly subscription payment - add credits
        const invoice = event.data.object
        const stripeCustomerId = invoice.customer

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, stripeCustomerId))
          .limit(1)

        if (user && user.tier !== 'free') {
          const tierConfig = TIERS[user.tier as keyof typeof TIERS]
          const monthlyCredits = tierConfig?.monthlyCredits

          if (typeof monthlyCredits === 'number' && monthlyCredits > 0) {
            await db
              .update(users)
              .set({ credits: user.credits + monthlyCredits })
              .where(eq(users.id, user.id))

            await db.insert(transactions).values({
              id: nanoid(),
              userId: user.id,
              type: 'subscription',
              amount: monthlyCredits,
              description: `Monthly ${user.tier} subscription credits`,
              stripePaymentId: invoice.payment_intent,
            })
          }
        }
        break
      }

      default:
        console.log('Unhandled Stripe event:', event.type)
    }

    return c.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return c.json({ error: 'Webhook handler failed' }, 500)
  }
})
