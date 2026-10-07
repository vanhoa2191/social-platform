import { build } from 'esbuild'

const shared = {
  bundle: true,
  minify: false,
  sourcemap: true,
  target: ['chrome120'],
  logLevel: 'info',
}

await build({
  ...shared,
  entryPoints: ['src/extension/background.ts'],
  outfile: 'dist/background.js',
  format: 'esm',
  platform: 'browser',
})

await build({
  ...shared,
  entryPoints: ['src/extension/content.ts'],
  outfile: 'dist/content.js',
  format: 'iife',
  platform: 'browser',
})

console.log('Extension runtime bundles created.')
