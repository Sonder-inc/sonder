// Credit costs per 1M tokens (in dollars, which equals credits 1:1)
export const CREDIT_COSTS: Record<string, { input: number; output: number }> = {
  'deepseek/deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek/deepseek-reasoner': { input: 0.55, output: 2.19 },
  'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-3.5-haiku': { input: 0.8, output: 4.0 },
  'anthropic/claude-3-opus': { input: 15.0, output: 75.0 },
  'openai/gpt-4o': { input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'google/gemini-2.0-flash-exp': { input: 0.1, output: 0.4 },
}

// Credits awarded for GitHub contributions
export const CONTRIBUTION_REWARDS = {
  star: 5,
  issue: 10,
  pr_opened: 20,
  pr_merged: 100,
} as const

// Subscription tiers
export const TIERS = {
  free: { monthlyCredits: 0, priceId: null },
  pro: { monthlyCredits: 10, priceId: 'price_pro' }, // $10/month
  max: { monthlyCredits: 50, priceId: 'price_max' }, // $50/month
  black: { monthlyCredits: Infinity, priceId: 'price_black' }, // unlimited
} as const

// GitHub OAuth config
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'YOUR_CLIENT_ID'
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'YOUR_CLIENT_SECRET'

// Session config
export const SESSION_EXPIRY_DAYS = 30

// Calculate credit cost for tokens
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = CREDIT_COSTS[model]
  if (!costs) {
    // Default fallback pricing
    return (inputTokens * 1.0 + outputTokens * 3.0) / 1_000_000
  }
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000
}
