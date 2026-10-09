import { readFile } from 'node:fs/promises'
import { validateStagingConfig } from './staging-config.mjs'

const firebasePath = process.argv[2] || '.env.staging.local'
const wranglerPath = process.argv[3] || 'wrangler.staging.toml'
let firebaseText
let wranglerText
try {
  [firebaseText, wranglerText] = await Promise.all([
    readFile(firebasePath, 'utf8'),
    readFile(wranglerPath, 'utf8'),
  ])
} catch {
  console.error('Staging config files not found. Expected: ' + firebasePath + ' and ' + wranglerPath)
  process.exitCode = 1
}

if (firebaseText !== undefined && wranglerText !== undefined) {
  const issues = validateStagingConfig(firebaseText, wranglerText, {
    allowMock: process.env.ALLOW_MOCK_PILOT === '1',
  })
  if (issues.length) {
    for (const issue of issues) console.error('- ' + issue)
    process.exitCode = 1
  } else {
    console.log('Staging preflight passed (configuration only, no external resources touched).')
  }
}
