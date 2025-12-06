#!/usr/bin/env bun

import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { Command } from 'commander'
import React from 'react'
import { resolve } from 'path'
import { existsSync } from 'fs'

import { App } from './app'
import { initializeThemeStore } from './hooks/use-theme'
import { checkForUpdates, performUpdate } from './utils/updater'
import { initSonder } from './utils/init'

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

  // Check for updates on launch
  try {
    const updateInfo = await checkForUpdates()
    if (updateInfo?.available) {
      console.log(`\x1b[36msonder ${updateInfo.currentVersion} → ${updateInfo.latestVersion}\x1b[0m`)
      const success = performUpdate(updateInfo.latestVersion)
      if (success) {
        console.log('\x1b[32mupdated!\x1b[0m\n')
        // Re-execute sonder with same args
        const { spawn } = await import('child_process')
        spawn(process.argv[0], process.argv.slice(1), {
          stdio: 'inherit',
          env: process.env,
        })
        process.exit(0)
      }
    }
  } catch {
    // Silently ignore update failures
  }

  // Initialize theme store before rendering
  initializeThemeStore()

  // Initialize sonder (user config, tools, agents, MCPs)
  await initSonder()

  const renderer = await createCliRenderer({
    backgroundColor: 'transparent',
    exitOnCtrlC: false,
  })

  const version = loadPackageVersion()
  const fullPath = process.cwd()
  const parts = fullPath.split('/')
  const launchDir = parts.slice(-2).join('/')

  createRoot(renderer).render(<App initialPrompt={initialPrompt} version={version} launchDir={launchDir} />)
}

void main()
