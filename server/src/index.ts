import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { chatRoutes } from './routes/chat'
import { userRoutes } from './routes/user'
import { stripeRoutes } from './routes/stripe'
import { githubWebhookRoutes } from './routes/github-webhook'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'sonder-api' }))
app.get('/health', (c) => c.json({ status: 'healthy' }))

// Routes
app.route('/auth', authRoutes)
app.route('/chat', chatRoutes)
app.route('/user', userRoutes)
app.route('/stripe', stripeRoutes)
app.route('/webhooks/github', githubWebhookRoutes)

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = parseInt(process.env.PORT || '3000')

console.log(`Sonder API server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
