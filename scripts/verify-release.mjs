import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const AdmZip = require('adm-zip')

const manifest = JSON.parse(await readFile(resolve('dist/manifest.json'), 'utf8'))
const channel = (process.env.RELEASE_CHANNEL || 'beta').replace(/[^a-z0-9._-]/gi, '-')
const baseName = `autotool-v${manifest.version}-${channel}`
const zipPath = resolve('release', `${baseName}.zip`)
const shaPath = resolve('release', `${baseName}.sha256`)
const metadataPath = resolve('release', `${baseName}.json`)

const [buffer, checksumLine, metadataText] = await Promise.all([
  readFile(zipPath),
  readFile(shaPath, 'utf8'),
  readFile(metadataPath, 'utf8'),
])

const actualSha = createHash('sha256').update(buffer).digest('hex')
const expectedSha = checksumLine.trim().split(/\s+/)[0]
if (actualSha !== expectedSha) throw new Error('Release checksum mismatch')

const zip = new AdmZip(zipPath)
const entries = new Set(zip.getEntries().map((entry) => entry.entryName))
for (const required of ['manifest.json', 'index.html', 'background.js', 'content.js']) {
  if (!entries.has(required)) throw new Error(`Release archive missing ${required}`)
}

const zippedManifest = JSON.parse(zip.readAsText('manifest.json'))
if (zippedManifest.version !== manifest.version) throw new Error('Release manifest version mismatch')

const metadata = JSON.parse(metadataText)
if (metadata.sha256 !== actualSha) throw new Error('Release metadata checksum mismatch')
if (metadata.version !== manifest.version) throw new Error('Release metadata version mismatch')
if (metadata.channel !== channel) throw new Error('Release metadata channel mismatch')
if (zippedManifest.version_name !== `${manifest.version}-${channel}`) throw new Error('Release manifest version_name/channel mismatch')
if (metadata.versionName !== zippedManifest.version_name) throw new Error('Release metadata versionName mismatch')
if (metadata.pilotDefault !== true) throw new Error('Release metadata must declare pilotDefault=true')

console.log('Release package verified:', baseName)
