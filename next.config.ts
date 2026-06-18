import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { resolveWorkerUrl } from './src/lib/worker-url'

// Lets `next dev` see Cloudflare bindings/env via the OpenNext adapter.
// Safe no-op in production builds.
initOpenNextCloudflareForDev()

// Worker/API origin the browser talks to — allowed in CSP connect-src/img-src so
// client fetches (lib/api.ts) aren't blocked. Resolved through the SAME helper as
// the client so the allow-list and the actual fetch target can never diverge: in
// dev the prod-isolation guard pins this to localhost:8787, matching lib/api.ts
// (otherwise the CSP would silently block every dev API call). Empty in pure-static builds.
const workerUrl = resolveWorkerUrl(process.env)

// Content-Security-Policy. Pragmatic, non-breaking baseline:
//  - 'unsafe-inline' on script/style is required by Next's inline bootstrap +
//    Tailwind's injected styles (tightening to nonces needs middleware — a
//    follow-up, not a blocker).
//  - 'unsafe-eval' is dev-only: React/Turbopack use eval() for debugging features
//    (e.g. reconstructing callstacks). React never uses eval() in production, so
//    we keep it out of the prod policy to stay locked down.
//  - Stripe.js + Turnstile are allow-listed for both script and frame.
//  - img-src stays broad (https:) because product images can be any merchant URL.
const isDev = process.env.NODE_ENV !== 'production'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${workerUrl ? ` ${workerUrl}` : ''}`,
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com${workerUrl ? ` ${workerUrl}` : ''}`,
  'frame-src https://js.stripe.com https://challenges.cloudflare.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  turbopack: {},
  // Inline the (already-minified) CSS as a <style> in the HTML instead of a render-blocking
  // <link rel=stylesheet>, so styles arrive WITH the document and the browser paints without
  // a second round-trip — the render-block/LCP lever PageSpeed flags (~560ms on mobile).
  // NOTE: this is NOT experimental.optimizeCss (critters) below — there is no per-request
  // critical-CSS extraction; it just embeds the built CSS string. Trade-off: ~22 KiB rides
  // in each HTML response (no separate CSS cache), a good fit for our small atomic Tailwind
  // bundle + first-load focus. https://nextjs.org/docs/app/api-reference/config/next-config-js/inlineCss
  experimental: { inlineCss: true },
  // NOTE: we intentionally do NOT use experimental.optimizeCss. Next implements
  // it via require('critters') (deprecated); the maintained fork (beasties) would
  // have to be aliased to that name, and either way the inlining runs as an SSR
  // post-process PER REQUEST — on CF Workers (workerd) that adds per-request CPU
  // and uses Node fs APIs that aren't reliable in the sandbox. The render-blocking
  // CSS bundle is ~21 KiB and loads fast on the real edge; the multi-second
  // "savings" Lighthouse shows came from the Tailscale tunnel latency, not the app.
  // Allow cross-origin dev requests from any Tailscale tunnel host (HTTPS
  // page-speed testing over the tailnet). Wildcard covers every *.ts.net node.
  allowedDevOrigins: ['*.ts.net'],
  images: {
    // Custom loader: rewrites picsum demo URLs to the requested display width so
    // Next's srcset serves right-sized images (~10× smaller on a ~195px grid slot).
    // Non-picsum URLs (R2 /cdn/..., data:, blob:) are returned unchanged — they are
    // pre-compressed at upload and Cloudflare's free plan has no server resizing.
    // With a custom loader Next does NOT call its own optimizer endpoint (which
    // OpenNext/workerd can't run) — the loader just returns direct URLs and Next
    // builds a srcset from them via the `sizes` prop on each <Image>.
    loader: 'custom',
    loaderFile: './image-loader.ts',
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
