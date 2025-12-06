/**
 * Headless mode entry point
 * Called from main index.tsx when --headless flag is present
 */

import { initSonder } from '../utils/init'
import { runHeadless, type HeadlessResult } from './run'
import { readStdinPrompt, type ScopeConfig } from '../config/scope'

/**
 * Run sonder in headless mode
 * Initializes tools/agents, runs prompt, outputs JSON result
 */
export async function runHeadlessMode(scope: ScopeConfig): Promise<void> {
  if (!scope.headless) {
    console.error(JSON.stringify({ success: false, error: 'No headless config provided' }))
    process.exit(1)
  }

  // Check for prompt from stdin if not provided as argument
  let prompt = scope.headless.prompt
  if (!prompt) {
    prompt = await readStdinPrompt()
  }

  if (!prompt) {
    console.error(JSON.stringify({ success: false, error: 'No prompt provided. Use: sonder --headless "prompt" or pipe via stdin' }))
    process.exit(1)
  }

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error(JSON.stringify({ success: false, error: 'OPENROUTER_API_KEY environment variable not set' }))
    process.exit(1)
  }

  try {
    // Initialize sonder (tools, agents, MCPs)
    await initSonder()

    // Run the headless execution
    const result: HeadlessResult = await runHeadless({
      ...scope.headless,
      prompt,
    })

    // Output JSON result
    console.log(JSON.stringify(result, null, 2))

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1)
  } catch (error) {
    const errorResult: HeadlessResult = {
      success: false,
      response: '',
      toolCalls: [],
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
      tokensUsed: { input: 0, output: 0, total: 0 },
    }
    console.error(JSON.stringify(errorResult, null, 2))
    process.exit(1)
  }
}
