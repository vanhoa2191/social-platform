import { build } from 'esbuild'

const shared = {
  bundle: true,
  minify: true,
  sourcemap: process.env.BUILD_SOURCEMAP === '1',
  define: {
    'import.meta.env.VITE_AI_GATEWAY_ORIGIN': JSON.stringify(process.env.VITE_AI_GATEWAY_ORIGIN ?? ''),
  },
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
