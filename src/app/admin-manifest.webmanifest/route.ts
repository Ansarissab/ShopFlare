// ISR Web App Manifest for the admin PWA.
// revalidate=300: CF Pages edge caches for 5 min, avoiding per-request invocations.
export const revalidate = 300

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL?.replace(/\/$/, '') ?? ''
const FALLBACK_NAME = 'ShopFlare Admin'
const FALLBACK_THEME = '#1A1A18'
const FALLBACK_BG = '#141412'

type StoreConfig = { storeName?: string; primaryColor?: string; backgroundColor?: string }

async function getConfig(): Promise<StoreConfig> {
  try {
    if (!WORKER_URL) return {}
    const res = await fetch(`${WORKER_URL}/api/config/store`, { next: { revalidate: 300 } })
    if (!res.ok) return {}
    return (await res.json()) as StoreConfig
  } catch {
    return {}
  }
}

export async function GET() {
  const config = await getConfig()
  const storeName = config.storeName ?? ''
  const name = storeName ? `${storeName} Admin` : FALLBACK_NAME
  const themeColor = config.primaryColor ?? FALLBACK_THEME
  const bgColor = config.backgroundColor ?? FALLBACK_BG

  const manifest = {
    id: '/admin',
    name,
    short_name: 'Admin',
    description: 'Store admin dashboard',
    start_url: '/admin?source=pwa',
    scope: '/admin/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    background_color: bgColor,
    theme_color: themeColor,
    orientation: 'portrait-primary',
    launch_handler: { client_mode: 'focus-existing' },
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  })
}
