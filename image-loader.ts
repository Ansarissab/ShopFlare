/**
 * Custom Next.js image loader.
 *
 * Rules:
 *  - Picsum demo URLs (`https://picsum.photos/seed/<seed>/<w>/<h>`):
 *    rewrite to the requested display width so Next's srcset serves a
 *    right-sized image instead of the fixed 800×800 original (~10× oversized
 *    on a ~195 px grid slot). We keep it square because picsum crops anyway.
 *  - Everything else — R2 `/cdn/...` images (pre-compressed AVIF at upload),
 *    `data:` blobs, any other URL — is returned UNCHANGED. Cloudflare's free
 *    plan has no server-side resizing, so we must never rewrite these paths.
 */

interface LoaderParams {
  src: string
  width: number
  quality?: number
}

// Matches https://picsum.photos/seed/<seed>/<digits>/<digits> (trailing size segment)
const PICSUM_RE = /^(https:\/\/picsum\.photos\/seed\/[^/]+)\/\d+\/\d+$/

export default function imageLoader({ src, width }: LoaderParams): string {
  const match = PICSUM_RE.exec(src)
  if (match) {
    // Replace trailing /<w>/<h> with the requested display width (square)
    return `${match[1]}/${width}/${width}`
  }
  // Non-picsum: pass through untouched
  return src
}
