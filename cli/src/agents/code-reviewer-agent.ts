import { z } from 'zod'
import { defineAgent, type AgentResult } from './types'
import { executeAgentLLM } from '../services/agent-executor'

const CODE_REVIEWER_SYSTEM_PROMPT = `You are a security-focused code reviewer. Analyze code for:

1. Security vulnerabilities (OWASP Top 10, injection, XSS, etc.)
2. Logic errors and edge cases
3. Performance issues
4. Best practice violations

For cybersecurity/pentesting code, also check:
- Proper error handling
- Input validation
- Credential handling
- Network security

Output format (JSON):
{
  "severity": "critical|high|medium|low|info",
  "issues": [
    {
      "type": "security|bug|performance|style",
      "severity": "critical|high|medium|low",
      "line": "optional line number or range",
      "description": "what's wrong",
      "suggestion": "how to fix"
    }
  ],
  "summary": "overall assessment",
  "approved": true/false
}

Only output JSON, nothing else.`

const codeReviewerParams = z.object({
  code: z.string().describe('Code to review'),
  language: z.string().optional().describe('Programming language'),
  context: z.string().optional().describe('What this code does or is meant to do'),
  focusAreas: z.array(z.string()).optional().describe('Specific areas to focus on'),
})

type CodeReviewerParams = z.infer<typeof codeReviewerParams>

export interface CodeIssue {
  type: 'security' | 'bug' | 'performance' | 'style'
  severity: 'critical' | 'high' | 'medium' | 'low'
  line?: string
  description: string
  suggestion: string
}

export interface CodeReviewerResult {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  issues: CodeIssue[]
  summary: string
  approved: boolean
}

export const codeReviewerAgent = defineAgent<typeof codeReviewerParams, CodeReviewerResult>({
  name: 'reviewer',
  description: 'Review code, plans, or approaches. Identifies issues, suggests improvements, validates correctness.',
  systemPrompt: CODE_REVIEWER_SYSTEM_PROMPT,
  parameters: codeReviewerParams,

  async execute(params: CodeReviewerParams, agentContext): Promise<AgentResult<CodeReviewerResult>> {
    let userPrompt = 'Review this code:\n\n```'
    if (params.language) userPrompt += params.language
    userPrompt += `\n${params.code}\n\`\`\``

    if (params.context) {
      userPrompt += `\n\nContext: ${params.context}`
    }

    if (params.focusAreas && params.focusAreas.length > 0) {
      userPrompt += `\n\nFocus on: ${params.focusAreas.join(', ')}`
    }

    const result = await executeAgentLLM({
      name: 'reviewer',
      systemPrompt: CODE_REVIEWER_SYSTEM_PROMPT,
      userPrompt,
      context: agentContext,
    })

    if (!result.success) {
      return {
        success: false,
        summary: 'Review failed',
        data: {
          severity: 'info',
          issues: [],
          summary: 'Could not complete review',
          approved: false,
        },
      }
    }

    try {
      const data = JSON.parse(result.text) as CodeReviewerResult
      const issueCount = data.issues.length
      const criticalCount = data.issues.filter(i => i.severity === 'critical').length

      return {
        success: true,
        summary: criticalCount > 0
          ? `${criticalCount} critical issues`
          : issueCount > 0
            ? `${issueCount} issue${issueCount !== 1 ? 's' : ''}`
            : 'No issues found',
        data,
      }
    } catch {
      return {
        success: false,
        summary: 'Failed to parse review',
        data: {
          severity: 'info',
          issues: [],
          summary: result.text,
          approved: false,
        },
      }
    }
  },
})
