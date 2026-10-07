import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const manifest = JSON.parse(await readFile(resolve('dist/manifest.json'), 'utf8'))
const channel = (process.env.RELEASE_CHANNEL || 'beta').toLowerCase()

if (!['beta', 'stable'].includes(channel)) {
  throw new Error(`Unsupported release channel: ${channel}`)
}

if (channel === 'stable') {
  if (process.env.RELEASE_APPROVED !== '1') {
    throw new Error('Stable release blocked: RELEASE_APPROVED=1 is required.')
  }

  const expectedTag = `v${manifest.version}`
  const actualTag = process.env.GITHUB_REF_NAME || process.env.RELEASE_TAG
  if (actualTag !== expectedTag) {
    throw new Error(`Stable release blocked: expected tag ${expectedTag}, received ${actualTag || 'none'}.`)
  }
}

console.log(`Release gate passed: ${manifest.version} · ${channel}`)
