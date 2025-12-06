import { z } from 'zod'
import { defineTool, type ToolResult } from './types'

const statusParams = z.object({
  message: z.string().describe('Short status update (what you are doing now)'),
})

export const status = defineTool({
  name: 'status',
  description: 'Post a short status update to show progress. Use this to narrate what you are doing before taking action.',
  parameters: statusParams,

  async execute({ message }): Promise<ToolResult> {
    // Instant return - just for display
    return {
      success: true,
      summary: '',
      fullResult: '',
      displayName: '',
      displayInput: message,
    }
  },
})
