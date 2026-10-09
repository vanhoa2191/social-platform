import { build } from 'esbuild'

await build({
  bundle: true,
  minify: true,
  sourcemap: process.env.BUILD_SOURCEMAP === '1',
  target: ['es2022'],
  entryPoints: ['src/gateway/worker.ts'],
  outfile: 'dist-gateway/worker.js',
  format: 'esm',
  platform: 'browser',
  logLevel: 'info',
})

console.log('AI gateway worker bundle created.')
