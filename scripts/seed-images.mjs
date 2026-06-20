// Upload demo product photos to the R2 bucket the Worker serves at /cdn/<key>.
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
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const execFileAsync = promisify(execFile)

const BUCKET = 'shopflare-images0'
const remote = process.argv.includes('--remote')
// Remote R2 (API) handles parallel puts fine. LOCAL R2 is one miniflare sqlite
// state file — concurrent `wrangler --local` processes contend on it and fail
// with "put: Unspecified error (500)", so local must be sequential.
const CONCURRENCY = remote ? 8 : 1
const reset = process.argv.includes('--reset')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'seed-assets', 'products')

const files = readdirSync(dir).filter((f) => f.endsWith('.avif'))
if (files.length === 0) {
  console.error(`No .avif files in ${dir}`)
  process.exit(1)
}

/** Run tasks with at most `limit` concurrent promises. */
async function pool(items, limit, fn) {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      await fn(item)
    }
  })
  await Promise.all(workers)
}

const start = Date.now()

if (reset) {
  console.log(`Deleting existing demo objects from ${BUCKET} (${remote ? 'remote' : 'local'})…`)
  await pool(files, CONCURRENCY, async (file) => {
    const key = `demo/${file.replace(/\.avif$/, '.jpg')}`
    try {
      await execFileAsync('npx', [
        'wrangler',
        'r2',
        'object',
        'delete',
        `${BUCKET}/${key}`,
        remote ? '--remote' : '--local',
      ])
      console.log(`  deleted: ${key}`)
    } catch {
      console.log(`  skipped (not found): ${key}`)
    }
  })
}

console.log(`Uploading ${files.length} files to ${BUCKET} (${remote ? 'remote' : 'local'})…`)
await pool(files, CONCURRENCY, async (file) => {
  const key = `demo/${file.replace(/\.avif$/, '.jpg')}`
  await execFileAsync('npx', [
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
  ])
  console.log(`  ok: ${key}`)
})

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(
  `\nUploaded ${files.length} demo images to ${BUCKET} (${remote ? 'remote' : 'local'}) in ${elapsed}s.`,
)
