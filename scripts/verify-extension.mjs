import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const required = ['dist/index.html', 'dist/manifest.json', 'dist/background.js', 'dist/content.js']
for (const file of required) {
  await access(resolve(file))
}

const manifest = JSON.parse(await readFile(resolve('dist/manifest.json'), 'utf8'))
if (manifest.manifest_version !== 3) throw new Error('Expected Manifest V3')
if (manifest.background?.service_worker !== 'background.js') throw new Error('Invalid background bundle path')
if (!manifest.content_scripts?.some((entry) => entry.js?.includes('content.js'))) {
  throw new Error('content.js is not registered in manifest')
}

console.log('Extension build verified:', manifest.name, manifest.version)
