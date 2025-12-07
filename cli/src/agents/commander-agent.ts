/**
 * Commander Agent - Shell Command Execution with LLM Analysis
 *
 * Uses generator-based handleSteps pattern (codebuff architecture).
 * Executes shell commands via run_terminal_command tool, then
 * lets the LLM analyze and summarize the output.
 */

import { z } from 'zod'
import { defineGeneratorAgent, type AgentStepContext, type StepResult, type AgentToolCall } from './types'

const commanderParams = z.object({
  command: z.string().describe('Shell command to execute'),
  prompt: z.string().optional().describe('What information from the output is desired'),
  working_directory: z.string().optional().describe('Working directory for command'),
  timeout_seconds: z.number().optional().default(30).describe('Timeout in seconds (-1 for no timeout)'),
})

export const commanderAgent = defineGeneratorAgent({
  name: 'commander',
  id: 'commander',
  model: 'anthropic/claude-3.5-haiku',

  description: 'Runs shell commands like npm, git, test runners. NOT for creating files (use editor instead). NOT for mkdir (editor auto-creates dirs).',

  spawnerPrompt:
    'Execute shell commands (npm install, git, python, etc) and analyze output. DO NOT use for file creation - use editor tool instead. DO NOT use mkdir - editor auto-creates directories.',

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'What information from the command output is desired. Be specific about what to look for or extract.',
    },
    params: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Terminal command to run' },
        working_directory: { type: 'string', description: 'Working directory for command' },
        timeout_seconds: { type: 'number', description: 'Timeout in seconds (-1 for no timeout, default 30)' },
      },
      required: ['command'],
    },
  },

  outputMode: 'last_message',
  toolNames: ['run_terminal_command'],

  systemPrompt: `You are an expert at analyzing the output of terminal commands.

Your job is to:
1. Review the terminal command and its output
2. Analyze the output based on what the user requested
3. Provide a clear, concise description of the relevant information

When describing command output:
- Use excerpts from the actual output when possible (especially for errors, key values, or specific data)
- Focus on the information the user requested
- Be concise but thorough
- If the output is very long, summarize the key points rather than reproducing everything
- Don't include any follow up recommendations, suggestions, or offers to help`,

  instructionsPrompt: `The user has provided a command to run and specified what information they want from the output.

Run the command and then describe the relevant information from the output, following the user's instructions about what to focus on.

Do not use any tools! Only analyze the output of the command.`,

  parameters: commanderParams,

  *handleSteps({
    params,
  }: AgentStepContext): Generator<AgentToolCall | 'STEP' | 'STEP_ALL', void, StepResult> {
    const { command, working_directory, timeout_seconds } = params as z.infer<typeof commanderParams>

    if (!command) {
      return
    }

    // Step 1: Execute the terminal command
    yield {
      toolName: 'run_terminal_command',
      input: {
        command,
        working_directory,
        timeout_seconds,
      },
    }

    // Step 2: Let the LLM analyze and describe the output
    yield 'STEP'
  },
})
