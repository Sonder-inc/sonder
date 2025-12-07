/**
 * Researcher Web Agent - Web Research Synthesis
 *
 * Analyzes search results and web content to synthesize findings.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const RESEARCHER_SYSTEM_PROMPT = `You are a web research agent. Given search results or web content, you:

1. Extract key information relevant to the query
2. Synthesize findings into actionable insights
3. Identify authoritative sources
4. Note any gaps in the information

Output format (JSON):
{
  "summary": "brief summary of findings",
  "keyPoints": ["point1", "point2"],
  "sources": [{"title": "...", "url": "...", "relevance": "high|medium|low"}],
  "caveats": ["any warnings or limitations"],
  "nextSteps": ["suggested follow-up queries or actions"]
}

Only output JSON, nothing else.`

const researcherParams = z.object({
  query: z.string().describe('The research question or topic'),
  searchResults: z.string().optional().describe('Raw search results to analyze'),
  webContent: z.string().optional().describe('Scraped web page content'),
})

export interface ResearchSource {
  title: string
  url: string
  relevance: 'high' | 'medium' | 'low'
}

export interface ResearcherResult {
  summary: string
  keyPoints: string[]
  sources: ResearchSource[]
  caveats: string[]
  nextSteps: string[]
}

export const searchFetch = defineGeneratorAgent<typeof researcherParams, ResearcherResult>({
  name: 'search_fetch',
  id: 'search_fetch',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Analyzes search results and synthesizes web research findings.',

  spawnerPrompt: 'Synthesizes web search results and content into actionable insights. Use for research tasks requiring web information.',

  outputMode: 'structured_output',

  systemPrompt: RESEARCHER_SYSTEM_PROMPT,

  parameters: researcherParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM synthesis - just run a step
    yield 'STEP'
  },
})
