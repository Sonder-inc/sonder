/**
 * Context Pruner Agent - Context Optimization
 *
 * Compresses and optimizes context for LLM calls.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const CONTEXT_PRUNER_SYSTEM_PROMPT = `You are a context optimization agent. Your job is to compress and prioritize context for LLM calls.

Given a large context (conversation history, file contents, etc.), you:
1. Identify the most relevant information for the current task
2. Remove redundant or outdated information
3. Summarize verbose sections
4. Preserve critical details (code, commands, errors)

Rules:
- Keep exact code snippets if they're relevant
- Preserve error messages verbatim
- Summarize repeated back-and-forth
- Remove pleasantries and filler
- Prioritize recent and task-relevant info

Output format (JSON):
{
  "prunedContext": "the compressed context",
  "removedSections": ["what was removed and why"],
  "preservedCritical": ["key items preserved exactly"],
  "compressionRatio": 0.5,
  "tokenEstimate": 1000
}

Only output JSON, nothing else.`

const contextPrunerParams = z.object({
  context: z.string().describe('The full context to prune'),
  currentTask: z.string().describe('What the user is currently trying to do'),
  maxTokens: z.number().optional().default(4000).describe('Target token limit'),
})

export interface ContextPrunerResult {
  prunedContext: string
  removedSections: string[]
  preservedCritical: string[]
  compressionRatio: number
  tokenEstimate: number
}

export const compact = defineGeneratorAgent<typeof contextPrunerParams, ContextPrunerResult>({
  name: 'compact',
  id: 'compact',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Compresses and optimizes context for LLM calls.',

  spawnerPrompt: 'Compresses large contexts while preserving critical information. Use to reduce token usage before expensive LLM calls.',

  outputMode: 'structured_output',

  systemPrompt: CONTEXT_PRUNER_SYSTEM_PROMPT,

  parameters: contextPrunerParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM compression - just run a step
    yield 'STEP'
  },
})
