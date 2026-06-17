// ISR Web App Manifest for the storefront.
// Fetches store config so name/colors/icons reflect merchant branding.
// revalidate=300: CF Pages edge caches for 5 min, avoiding per-request invocations.
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import type { StoreConfig } from '@/lib/types/common'

export const revalidate = 300

const FALLBACK_NAME = 'ShopFlare'
const FALLBACK_THEME = '#1A1A18'
const FALLBACK_BG = '#141412'

export async function GET() {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })

  const name = config?.storeName ?? FALLBACK_NAME
  const shortName = name.length > 12 ? name.slice(0, 12) : name
  const themeColor = config?.primaryColor ?? FALLBACK_THEME
  const bgColor = FALLBACK_BG

  const icons = [
    {
      src: config?.logoUrl ?? '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: config?.logoUrl ?? '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icon-monochrome-192.png', sizes: '192x192', type: 'image/png', purpose: 'monochrome' },
  ]

  const manifest = {
    id: '/',
    name,
    short_name: shortName,
    description: config?.tagline ?? 'Your online store',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    background_color: bgColor,
    theme_color: themeColor,
    orientation: 'portrait-primary',
    launch_handler: { client_mode: 'focus-existing' },
    icons,
    screenshots: [
      { src: '/screenshot-mobile.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow' },
    ],
    shortcuts: [
      {
        name: 'Track Order',
        url: '/track',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
    categories: ['shopping'],
    prefer_related_applications: false,
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  })
}
