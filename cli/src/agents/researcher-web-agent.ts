import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

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

type ResearcherParams = z.infer<typeof researcherParams>

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

export const researcherWebAgent = defineAgent<typeof researcherParams, ResearcherResult>({
  name: 'researcher_web',
  description: 'Analyze web search results and content. Extracts key information and synthesizes findings.',
  systemPrompt: RESEARCHER_SYSTEM_PROMPT,
  parameters: researcherParams,

  async execute(params: ResearcherParams, context): Promise<AgentResult<ResearcherResult>> {
    let userPrompt = `Research query: "${params.query}"`

    if (params.searchResults) {
      userPrompt += `\n\nSearch results:\n${params.searchResults}`
    }

    if (params.webContent) {
      const truncated = params.webContent.length > 5000
        ? params.webContent.slice(0, 5000) + '\n...[truncated]'
        : params.webContent
      userPrompt += `\n\nWeb content:\n${truncated}`
    }

    const result = await executeAgentLLM({
      name: 'researcher_web',
      systemPrompt: RESEARCHER_SYSTEM_PROMPT,
      userPrompt,
      context,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Research failed',
        data: {
          summary: '',
          keyPoints: [],
          sources: [],
          caveats: [],
          nextSteps: [],
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as ResearcherResult

      return {
        success: true,
        summary: data.summary.slice(0, 100),
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse research',
        data: {
          summary: result.text,
          keyPoints: [],
          sources: [],
          caveats: [],
          nextSteps: [],
        },
      }
    }
  },
})
