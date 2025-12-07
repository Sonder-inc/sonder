/**
 * Code Reviewer Agent - Security-Focused Code Review
 *
 * Analyzes code for security vulnerabilities, bugs, and best practices.
 * Uses generator pattern with structured output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

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

export const reviewer = defineGeneratorAgent<typeof codeReviewerParams, CodeReviewerResult>({
  name: 'reviewer',
  id: 'reviewer',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Security-focused code review. Identifies vulnerabilities, bugs, and suggests improvements.',

  spawnerPrompt: 'Reviews code for security issues, bugs, and best practice violations. Use for validating code quality and security.',

  outputMode: 'structured_output',

  systemPrompt: CODE_REVIEWER_SYSTEM_PROMPT,

  parameters: codeReviewerParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    // Pure LLM analysis - just run a step
    yield 'STEP'
  },
})
