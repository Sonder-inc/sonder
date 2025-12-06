#!/usr/bin/env bun

/**
 * Build release binaries for all platforms
 * Run: bun run scripts/build-release.ts
 */

import { $ } from 'bun'
import { mkdirSync, existsSync, renameSync } from 'fs'
import { join } from 'path'

const platforms = [
  { target: 'bun-darwin-arm64', name: 'darwin-arm64' },
  { target: 'bun-darwin-x64', name: 'darwin-x64' },
  { target: 'bun-linux-arm64', name: 'linux-arm64' },
  { target: 'bun-linux-x64', name: 'linux-x64' },
]

const releaseDir = join(import.meta.dir, '../release')

async function build() {
  // Clean and create dirs
  if (existsSync(releaseDir)) {
    await $`rm -rf ${releaseDir}`
  }
  mkdirSync(releaseDir, { recursive: true })

  console.log('Building release binaries...\n')

  for (const { target, name } of platforms) {
    console.log(`Building for ${name}...`)

    const binaryFile = join(releaseDir, 'sonder')
    const tarFile = join(releaseDir, `sonder-${name}.tar.gz`)

    try {
      // Build standalone binary named 'sonder'
      await $`bun build src/index.tsx --compile --target=${target} --outfile=${binaryFile}`.quiet()

      // Create tarball containing 'sonder'
      await $`tar -czvf ${tarFile} -C ${releaseDir} sonder`.quiet()

      // Remove binary (keep only tarball)
      await $`rm ${binaryFile}`.quiet()

      console.log(`  ✓ ${tarFile}`)
    } catch (e) {
      console.log(`  ✗ Failed: ${e}`)
    }
  }

  console.log('\nDone! Upload release/*.tar.gz to GitHub releases')
}

build()
