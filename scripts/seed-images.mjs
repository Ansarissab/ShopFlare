// Upload the committed demo product photos to the R2 bucket the Worker serves at /cdn/<key>.
//
// The bytes live in seed-assets/products/<name>.avif (small AVIF, Unsplash free license). They map
// to the r2_key values in worker/db/seed.sql as demo/<name>.jpg — the .jpg name is historical; the
// content is AVIF and uploaded with `--content-type image/avif`, which is what browsers honour.
//
//   pnpm seed:images            → local R2 (miniflare state) for `wrangler dev` / opennext preview
//   pnpm seed:images -- --remote → the deployed R2 bucket (run once before/after a prod deploy)
//
// Pairs with `pnpm db:seed` (the SQL rows). Keep both in sync: one row per file.

import { readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BUCKET = 'shopflare-images0'
const remote = process.argv.includes('--remote')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'seed-assets', 'products')

const files = readdirSync(dir).filter((f) => f.endsWith('.avif'))
if (files.length === 0) {
  console.error(`No .avif files in ${dir}`)
  process.exit(1)
}

for (const file of files) {
  // seed.sql r2_key uses the .jpg name (content is AVIF; see header note).
  const key = `demo/${file.replace(/\.avif$/, '.jpg')}`
  execFileSync(
    'npx',
    [
      'wrangler',
      'r2',
      'object',
      'put',
      `${BUCKET}/${key}`,
      remote ? '--remote' : '--local',
      '--file',
      join(dir, file),
      '--content-type',
      'image/avif',
    ],
    { stdio: 'inherit' },
  )
}

console.log(`\nUploaded ${files.length} demo images to ${BUCKET} (${remote ? 'remote' : 'local'}).`)
