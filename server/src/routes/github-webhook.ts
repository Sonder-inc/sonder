import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { db, users, contributions, transactions } from '../db'
import { CONTRIBUTION_REWARDS } from '../lib/constants'

export const githubWebhookRoutes = new Hono()

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET

// The GitHub repo to track contributions for
const TRACKED_REPO = process.env.GITHUB_TRACKED_REPO || 'sonder-cli/sonder'

/**
 * POST /webhooks/github
 * Handle GitHub webhook events for contribution rewards
 */
githubWebhookRoutes.post('/', async (c) => {
  const signature = c.req.header('x-hub-signature-256')
  const event = c.req.header('x-github-event')
  const delivery = c.req.header('x-github-delivery')
  const rawBody = await c.req.text()

  // TODO: Verify webhook signature
  // const expectedSignature = 'sha256=' + crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET).update(rawBody).digest('hex')
  // if (signature !== expectedSignature) {
  //   return c.json({ error: 'Invalid signature' }, 401)
  // }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  // Check if this is for our tracked repo
  const repoFullName = payload.repository?.full_name
  if (repoFullName !== TRACKED_REPO) {
    return c.json({ message: 'Ignoring event from untracked repo' })
  }

  console.log(`GitHub webhook: ${event} from ${repoFullName}`)

  try {
    switch (event) {
      case 'star': {
        if (payload.action === 'created') {
          await handleStar(payload, delivery || nanoid())
        }
        break
      }

      case 'issues': {
        if (payload.action === 'opened') {
          await handleIssueOpened(payload, delivery || nanoid())
        }
        break
      }

      case 'pull_request': {
        if (payload.action === 'opened') {
          await handlePROpened(payload, delivery || nanoid())
        } else if (payload.action === 'closed' && payload.pull_request?.merged) {
          await handlePRMerged(payload, delivery || nanoid())
        }
        break
      }

      default:
        console.log('Unhandled GitHub event:', event)
    }

    return c.json({ received: true })
  } catch (error) {
    console.error('GitHub webhook error:', error)
    return c.json({ error: 'Webhook handler failed' }, 500)
  }
})

/**
 * Award credits for starring the repo
 */
async function handleStar(payload: any, eventId: string) {
  const githubId = payload.sender?.id
  const githubUsername = payload.sender?.login

  if (!githubId) return

  await awardCredits(githubId, githubUsername, 'star', eventId, CONTRIBUTION_REWARDS.star)
}

/**
 * Award credits for opening an issue
 */
async function handleIssueOpened(payload: any, eventId: string) {
  const githubId = payload.issue?.user?.id
  const githubUsername = payload.issue?.user?.login
  const uniqueEventId = `issue-${payload.issue?.id}`

  if (!githubId) return

  await awardCredits(githubId, githubUsername, 'issue', uniqueEventId, CONTRIBUTION_REWARDS.issue)
}

/**
 * Award credits for opening a PR
 */
async function handlePROpened(payload: any, eventId: string) {
  const githubId = payload.pull_request?.user?.id
  const githubUsername = payload.pull_request?.user?.login
  const uniqueEventId = `pr-opened-${payload.pull_request?.id}`

  if (!githubId) return

  await awardCredits(githubId, githubUsername, 'pr_opened', uniqueEventId, CONTRIBUTION_REWARDS.pr_opened)
}

/**
 * Award credits for getting a PR merged
 */
async function handlePRMerged(payload: any, eventId: string) {
  const githubId = payload.pull_request?.user?.id
  const githubUsername = payload.pull_request?.user?.login
  const uniqueEventId = `pr-merged-${payload.pull_request?.id}`

  if (!githubId) return

  await awardCredits(githubId, githubUsername, 'pr_merged', uniqueEventId, CONTRIBUTION_REWARDS.pr_merged)
}

/**
 * Award credits to a user for a contribution
 */
async function awardCredits(
  githubId: number,
  githubUsername: string,
  type: 'star' | 'issue' | 'pr_opened' | 'pr_merged',
  eventId: string,
  credits: number
) {
  // Check if we already processed this event
  const [existing] = await db
    .select()
    .from(contributions)
    .where(eq(contributions.githubEventId, eventId))
    .limit(1)

  if (existing) {
    console.log(`Already processed event: ${eventId}`)
    return
  }

  // Find user by GitHub ID
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.githubId, githubId))
    .limit(1)

  if (!user) {
    console.log(`User not found for GitHub ID ${githubId} (${githubUsername}). Contribution will be credited when they sign up.`)
    // TODO: Store pending contributions for users who haven't signed up yet
    return
  }

  // Record contribution
  await db.insert(contributions).values({
    id: nanoid(),
    userId: user.id,
    type,
    githubEventId: eventId,
    creditsAwarded: credits,
  })

  // Add credits
  await db
    .update(users)
    .set({ credits: user.credits + credits })
    .where(eq(users.id, user.id))

  // Record transaction
  await db.insert(transactions).values({
    id: nanoid(),
    userId: user.id,
    type: 'contribution',
    amount: credits,
    description: `GitHub ${type}: +${credits} credits`,
  })

  console.log(`Awarded ${credits} credits to ${user.githubUsername} for ${type}`)
}
