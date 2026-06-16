import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'
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
  // Allow cross-origin dev requests from any Tailscale tunnel host (HTTPS
  // page-speed testing over the tailnet). Wildcard covers every *.ts.net node.
  allowedDevOrigins: ['*.ts.net'],
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  // SW disabled in dev to avoid cache-hell
  disable: isDev,
})

export default withSerwist(nextConfig)
