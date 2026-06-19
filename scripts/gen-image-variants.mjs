// Generates pre-sized R2 variant files for every base AVIF in seed-assets/products/.
import variantConfig from '../image-variants.config.json' with { type: 'json' }
import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, basename } from 'node:path'

const WIDTHS = variantConfig.variantWidths
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed-assets', 'products')

const baseFiles = readdirSync(dir).filter((f) => f.endsWith('.avif') && !/\.w\d+\.avif$/.test(f))

let written = 0

for (const file of baseFiles) {
  const inputPath = join(dir, file)
  const meta = await sharp(inputPath).metadata()
  const srcWidth = meta.width ?? 0
  const ext = extname(file)
  const stem = basename(file, ext)

  for (const w of WIDTHS) {
    if (srcWidth > 0 && srcWidth <= w) continue // don't upscale

    const outPath = join(dir, `${stem}.w${w}${ext}`)
    await sharp(inputPath).resize({ width: w }).avif({ quality: 50 }).toFile(outPath)
    written++
  }
}

console.log(`Written ${written} variant files.`)
