import { build } from 'esbuild'

await build({
  entryPoints: ['src/sw.ts'],
  outfile: 'public/sw.js',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
})
