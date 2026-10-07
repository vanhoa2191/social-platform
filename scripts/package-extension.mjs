import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const AdmZip = require('adm-zip')

const manifestPath = resolve('dist/manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const channel = (process.env.RELEASE_CHANNEL || 'beta').replace(/[^a-z0-9._-]/gi, '-')
const releaseDir = resolve('release')
const baseName = `autotool-v${manifest.version}-${channel}`
const zipPath = resolve(releaseDir, `${baseName}.zip`)
const shaPath = resolve(releaseDir, `${baseName}.sha256`)
const metadataPath = resolve(releaseDir, `${baseName}.json`)

await mkdir(releaseDir, { recursive: true })

manifest.version_name = `${manifest.version}-${channel}`
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

const zip = new AdmZip()
zip.addLocalFolder(resolve('dist'))
zip.writeZip(zipPath)

const buffer = await readFile(zipPath)
const sha256 = createHash('sha256').update(buffer).digest('hex')
const zipStat = await stat(zipPath)

await writeFile(shaPath, `${sha256}  ${basename(zipPath)}\n`)
await writeFile(metadataPath, JSON.stringify({
  product: manifest.name,
  version: manifest.version,
  versionName: manifest.version_name ?? null,
  channel,
  manifestVersion: manifest.manifest_version,
  minimumChromeVersion: manifest.minimum_chrome_version,
  archive: basename(zipPath),
  bytes: zipStat.size,
  sha256,
  pilotDefault: true,
  sourceCommit: process.env.GITHUB_SHA ?? null,
  createdAt: new Date().toISOString(),
}, null, 2) + '\n')

console.log('Extension release package created:', zipPath)
console.log('SHA256:', sha256)
