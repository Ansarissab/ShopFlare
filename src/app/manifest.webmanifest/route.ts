// ISR Web App Manifest for the storefront.
// Fetches store config so name/colors/icons reflect merchant branding.
// revalidate=300: CF Pages edge caches for 5 min, avoiding per-request invocations.
export const revalidate = 300

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL?.replace(/\/$/, '') ?? ''
const FALLBACK_NAME = 'ShopFlare'
const FALLBACK_THEME = '#1A1A18'
const FALLBACK_BG = '#141412'

type StoreConfig = {
  storeName?: string
  tagline?: string
  logoUrl?: string
  primaryColor?: string
  backgroundColor?: string
}

async function getConfig(): Promise<StoreConfig> {
  try {
    if (!WORKER_URL) return {}
    const res = await fetch(`${WORKER_URL}/api/config/store`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return {}
    return (await res.json()) as StoreConfig
  } catch {
    return {}
  }
}

export async function GET() {
  const config = await getConfig()

  const name = config.storeName ?? FALLBACK_NAME
  const shortName = name.length > 12 ? name.slice(0, 12) : name
  const themeColor = config.primaryColor ?? FALLBACK_THEME
  const bgColor = config.backgroundColor ?? FALLBACK_BG

  const icons = [
    { src: config.logoUrl ?? '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: config.logoUrl ?? '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icon-monochrome-192.png', sizes: '192x192', type: 'image/png', purpose: 'monochrome' },
  ]

  const manifest = {
    id: '/',
    name,
    short_name: shortName,
    description: config.tagline ?? 'Your online store',
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
