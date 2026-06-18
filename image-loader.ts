/**
 * Custom Next.js image loader for the Cloudflare/OpenNext runtime.
 *
 * WHY a custom loader: Next's built-in image optimizer runs as a Node service that
 * cannot run on Cloudflare Workers, so `next.config` previously set
 * `images.unoptimized = true` — which shipped full-size originals (an 800×800 served
 * into a ~195px grid slot) with no `srcset`. A custom loader restores responsive
 * `srcset`/`sizes` WITHOUT any server: it just maps (src, width) → a URL the browser
 * fetches directly.
 *
 * STRATEGY (generic, not host-hardcoded):
 *  - A source that exposes URL-based resizing is described by ONE entry in
 *    `RESIZE_RULES` (a match predicate + a width→URL builder). Add a source by adding
 *    a rule here — never special-case a host inline elsewhere.
 *  - Anything no rule matches is returned UNCHANGED. That is the correct default, not
 *    a gap: real merchant images live in R2 (`/cdn/...`) and are already compressed +
 *    sized at UPLOAD time (the browser-image-compression AVIF pipeline), and the
 *    Cloudflare free plan has no server-side resizing. `data:`/`blob:` must also pass
 *    through. So passthrough = "already optimized or cannot be resized for free".
 *
 * See docs/adr/0021-image-optimization-cloudflare.md.
 */

import { resolveWorkerUrl } from '@/lib/worker-url'

interface LoaderParams {
  src: string
  width: number
  quality?: number
}

interface ResizeRule {
  /** Identifies sources this rule can resize. */
  test: (src: string) => boolean
  /** Builds a URL for the requested display width. */
  toWidth: (src: string, width: number) => string
}

/**
 * Sources that support resizing purely via their URL. Order matters only if two rules
 * could match the same src (they don't today). Extend this list to support a new
 * resizable source; the loader and every <Image> pick it up automatically.
 */
const RESIZE_RULES: ResizeRule[] = [
  {
    // Demo seed data — Picsum: https://picsum.photos/seed/<seed>/<w>/<h>.
    // Rewrite the trailing /<w>/<h> to the requested display width (square; Picsum crops).
    test: (src) => /^https:\/\/picsum\.photos\/seed\/[^/]+\/\d+\/\d+$/.test(src),
    toWidth: (src, width) => src.replace(/\/\d+\/\d+$/, `/${width}/${width}`),
  },
]

/**
 * Worker origin that serves R2 product images at /cdn/<key>. Resolved through the SAME dev/prod
 * guard as the client (lib/api.ts) and CSP (next.config.ts) so the three can never diverge:
 * dev → http://localhost:8787, prod → the configured NEXT_PUBLIC_WORKER_URL. Resolved per call
 * (the helper is trivial and the env reads are build-time-inlined) so it stays test-stubbable.
 */
function workerOrigin(): string {
  return resolveWorkerUrl({
    NEXT_PUBLIC_WORKER_URL: process.env.NEXT_PUBLIC_WORKER_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ALLOW_REMOTE_API: process.env.NEXT_PUBLIC_ALLOW_REMOTE_API,
  })
}

export default function imageLoader({ src, width }: LoaderParams): string {
  // ENV-AGNOSTIC R2 path from the demo seed ('/cdn/demo/x.jpg') → prefix the worker origin so one
  // seed.sql works in every environment. Admin uploads store an ABSOLUTE '<origin>/cdn/<key>' URL,
  // which starts with http(s) (not '/cdn/') and falls through to passthrough unchanged.
  if (src.startsWith('/cdn/')) return `${workerOrigin()}${src}`
  for (const rule of RESIZE_RULES) {
    if (rule.test(src)) return rule.toWidth(src, width)
  }
  // No rule matched: absolute R2 /cdn (sized at upload), data:, blob:, or any other URL — leave as-is.
  return src
}
