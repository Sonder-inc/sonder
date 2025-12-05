#!/usr/bin/env bun

import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { Command } from 'commander'
import React from 'react'
import { resolve } from 'path'
import { existsSync } from 'fs'

import { App } from './app'
import { initializeThemeStore } from './hooks/use-theme'

// Load .env from parent directory
const envPath = resolve(import.meta.dir, '../../.env')
if (existsSync(envPath)) {
  const envContent = await Bun.file(envPath).text()
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex > 0) {
      process.env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim()
    }
  }
}

function loadPackageVersion(): string {
  if (process.env.SONDER_CLI_VERSION) {
    return process.env.SONDER_CLI_VERSION
  }

  try {
    const pkg = require('../package.json') as { version?: string }
    if (pkg.version) {
      return pkg.version
    }
  } catch {
    // Continue to dev fallback
  }

  return 'dev'
}

type ParsedArgs = {
  initialPrompt: string | null
}

function parseArgs(): ParsedArgs {
  const program = new Command()

  program
    .name('sonder')
    .description('Sonder - AI-powered cybersecurity learning assistant')
    .version(loadPackageVersion(), '-v, --version', 'Print the CLI version')
    .helpOption('-h, --help', 'Show this help message')
    .argument('[prompt...]', 'Initial prompt to send to the agent')
    .allowExcessArguments(true)
    .parse(process.argv)

  const args = program.args

  return {
    initialPrompt: args.length > 0 ? args.join(' ') : null,
  }
}

async function main(): Promise<void> {
  const { initialPrompt } = parseArgs()

  // Initialize theme store before rendering
  initializeThemeStore()

  const renderer = await createCliRenderer({
    backgroundColor: 'transparent',
    exitOnCtrlC: false,
  })

  createRoot(renderer).render(<App initialPrompt={initialPrompt} />)
}

void main()
