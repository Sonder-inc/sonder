import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// Users table - linked to GitHub accounts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  githubId: integer('github_id').unique().notNull(),
  githubUsername: text('github_username').notNull(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  credits: real('credits').default(0).notNull(),
  tier: text('tier', { enum: ['free', 'pro', 'max', 'black'] }).default('free').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Sessions table - auth tokens
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // Session token (nanoid)
  userId: text('user_id').references(() => users.id).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Device auth codes - for GitHub device flow
export const deviceCodes = sqliteTable('device_codes', {
  deviceCode: text('device_code').primaryKey(),
  userCode: text('user_code').notNull(),
  githubDeviceCode: text('github_device_code').notNull(),
  interval: integer('interval').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  accessToken: text('access_token'), // Filled when user authorizes
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Usage tracking - per API call
export const usage = sqliteTable('usage', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  cost: real('cost').notNull(), // Credits deducted
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Contributions - GitHub activity rewards
export const contributions = sqliteTable('contributions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type', { enum: ['star', 'issue', 'pr_opened', 'pr_merged'] }).notNull(),
  githubEventId: text('github_event_id').unique(), // Prevent duplicates
  creditsAwarded: real('credits_awarded').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Transactions - full audit trail
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type', { enum: ['purchase', 'usage', 'contribution', 'refund', 'subscription'] }).notNull(),
  amount: real('amount').notNull(), // + for credit, - for debit
  description: text('description'),
  stripePaymentId: text('stripe_payment_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type DeviceCode = typeof deviceCodes.$inferSelect
export type Usage = typeof usage.$inferSelect
export type Contribution = typeof contributions.$inferSelect
export type Transaction = typeof transactions.$inferSelect
