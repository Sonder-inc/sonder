import { z } from 'zod'
import { defineTool, type ToolResult } from './types'

const searchParams = z.object({
  query: z.string().describe('The search query'),
})

export const searchOnline = defineTool({
  name: 'search_online',
  description: 'Search the web for information. Use this when you need current information, documentation, writeups, or to find resources online.',
  parameters: searchParams,
  execute: async ({ query }): Promise<ToolResult> => {
    if (!query) {
      return {
        success: false,
        summary: 'No search query provided',
        fullResult: 'Error: Missing required parameter "query"',
      }
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlKey) {
      return {
        success: false,
        summary: 'No API key',
        fullResult: 'FIRECRAWL_API_KEY not set. Get one at https://firecrawl.dev',
      }
    }

    return searchWithFirecrawl(query, firecrawlKey)
  },
})

async function searchWithFirecrawl(query: string, apiKey: string): Promise<ToolResult> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as {
      success: boolean
      data?: Array<{
        url: string
        title?: string
        description?: string
        markdown?: string
      }>
    }

    if (!data.success || !data.data || data.data.length === 0) {
      return {
        success: true,
        summary: 'No results found',
        fullResult: `No search results found for "${query}"`,
      }
    }

    const results = data.data
    let fullResult = `Search results for "${query}":\n\n`

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      fullResult += `--- Result ${i + 1}: ${r.title || 'Untitled'} ---\n`
      fullResult += `URL: ${r.url}\n`
      if (r.description) {
        fullResult += `Description: ${r.description}\n`
      }
      if (r.markdown) {
        const content = r.markdown.length > 2000
          ? r.markdown.slice(0, 2000) + '\n...[truncated]'
          : r.markdown
        fullResult += `\nContent:\n${content}\n`
      }
      fullResult += '\n'
    }

    return {
      success: true,
      summary: `Found ${results.length} results`,
      fullResult,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      summary: 'Search failed',
      fullResult: `Error: ${errorMsg}`,
    }
  }
}
