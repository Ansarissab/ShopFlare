import variantConfig from '../../image-variants.config.json'

/** R2 pre-generated variant widths. 640 is the original (no suffix). */
export const R2_VARIANT_WIDTHS = variantConfig.variantWidths as number[]

/**
 * Maps a /cdn/...jpg path + requested display width to the smallest
 * pre-generated R2 variant key >= that width, or the original if none fits.
 *
 * Examples:
 *   r2VariantKey('/cdn/demo/mug.jpg', 384)  → '/cdn/demo/mug.w384.jpg'
 *   r2VariantKey('/cdn/demo/mug.jpg', 700)  → '/cdn/demo/mug.jpg'
 *   r2VariantKey('/cdn/demo/mug.jpg', 100)  → '/cdn/demo/mug.w256.jpg'
 */
export function r2VariantKey(path: string, width: number): string {
  const variant = R2_VARIANT_WIDTHS.find((w) => w >= width)
  if (variant === undefined) return path
  return path.replace(/(\.[^.]+)$/, `.w${variant}$1`)
}
