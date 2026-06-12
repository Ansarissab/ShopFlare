import type { Metadata } from 'next'
import { Geist, Geist_Mono, Instrument_Serif, Merriweather, Nunito } from 'next/font/google'
import '@/app/globals.css'
import { ServiceWorkerProvider } from '@/components/pwa/ServiceWorkerProvider'
import { JsonLd } from '@/components/shared/JsonLd'
import { organizationJsonLd } from '@/lib/seo/jsonld'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import type { StoreConfig } from '@/lib/types/common'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })
// Design-system display font — used for h1–h4 via --font-display CSS variable.
// next/font self-hosts automatically; no external request at runtime.
const instrumentSerif = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})
// Curated extra fonts — preload:false so they're only downloaded when selected by the merchant
const merriweather = Merriweather({
  variable: '--font-merriweather',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
})
const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})

// Dynamic store metadata — cached 5 min, fails gracefully when worker is unavailable.
export async function generateMetadata(): Promise<Metadata> {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
  try {
    if (!workerUrl) throw new Error('no worker url')
    const res = await fetch(`${workerUrl}/api/config/store`, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error('config fetch failed')
    const config = (await res.json()) as {
      storeName?: string
      tagline?: string
      logoUrl?: string
      faviconUrl?: string
    }
    return {
      title: {
        default: config.storeName ?? 'ShopFlare',
        template: `%s — ${config.storeName ?? 'ShopFlare'}`,
      },
      description: config.tagline ?? 'White-label ecommerce store',
      icons: config.faviconUrl ? { icon: config.faviconUrl } : undefined,
      openGraph: {
        title: config.storeName ?? 'ShopFlare',
        description: config.tagline ?? 'White-label ecommerce store',
        images: config.logoUrl ? [{ url: config.logoUrl }] : [],
        type: 'website',
      },
      twitter: { card: 'summary', title: config.storeName ?? 'ShopFlare' },
    }
  } catch {
    return {
      title: { default: 'ShopFlare', template: '%s — ShopFlare' },
      description: 'White-label ecommerce store',
    }
  }
}

// Inline boot script: reads localStorage snapshot and sets CSS vars + data-theme
// BEFORE React hydrates — eliminates flash of default colors on repeat visits.
// Keep in sync with applyTheme() in src/lib/theme.ts.
const bootScript = [
  '(function(){',
  "try{var s=localStorage.getItem('shopflare-theme');if(!s)return;var t=JSON.parse(s);",
  'var r=document.documentElement;',
  "var rad={none:'0rem',sm:'0.25rem',md:'0.5rem',lg:'0.75rem',full:'1.5rem'};",
  "var fnt={sans:'var(--font-geist-sans)',serif:'var(--font-merriweather)',mono:'var(--font-geist-mono)',rounded:'var(--font-nunito)'};",
  "var den={compact:'0.75',comfortable:'1',spacious:'1.25'};",
  'function lum(h){var rv=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,b=parseInt(h.slice(5,7),16)/255;',
  'function l(c){return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}',
  'return 0.2126*l(rv)+0.7152*l(g)+0.0722*l(b);}',
  "function fg(h){return lum(h)>0.179?'#000000':'#ffffff';}",
  "if(t.primaryColor){r.style.setProperty('--store-primary',t.primaryColor);",
  "r.style.setProperty('--store-primary-fg',t.primaryColorFg||fg(t.primaryColor));}",
  "if(t.accentColor){r.style.setProperty('--store-accent',t.accentColor);",
  "r.style.setProperty('--store-accent-fg',t.accentColorFg||fg(t.accentColor));}",
  "if(t.radius&&rad[t.radius])r.style.setProperty('--radius',rad[t.radius]);",
  "if(t.fontFamily&&fnt[t.fontFamily])r.style.setProperty('--store-font',fnt[t.fontFamily]);",
  "if(t.density&&den[t.density])r.style.setProperty('--density',den[t.density]);",
  "if(t.heroStyle)r.setAttribute('data-hero-style',t.heroStyle);",
  "if(t.colorMode){var dark=t.colorMode==='dark'||(t.colorMode==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);",
  "r.setAttribute('data-theme',dark?'dark':'light');}",
  '}catch(e){}',
  '})();',
].join('')

const workerOrigin = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })
  const orgBase = organizationJsonLd({
    name: config?.storeName ?? 'ShopFlare',
    url: siteUrl || undefined,
    logoUrl: config?.logoUrl ?? undefined,
    email: config?.contactEmail ?? undefined,
  })
  const org = {
    ...orgBase,
    ...(siteUrl ? { '@id': `${siteUrl}#org` } : {}),
  }

  const fontVars = `${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${merriweather.variable} ${nunito.variable}`
  return (
    <html lang="en" className={`${fontVars} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* No-flash theme boot: applies cached theme vars pre-paint */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        {/* Organization JSON-LD — sitewide entity anchor for structured data */}
        <JsonLd data={org} />
        {/* Preconnect to worker/CDN origin (logo, product images, API) */}
        {workerOrigin && <link rel="preconnect" href={workerOrigin} />}
        {workerOrigin && <link rel="dns-prefetch" href={workerOrigin} />}
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
        {/* PWA viewport and Apple Web App meta */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAFAF7" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141412" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      {/* suppressHydrationWarning: browser extensions inject attrs before React hydrates */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ServiceWorkerProvider>{children}</ServiceWorkerProvider>
      </body>
    </html>
  )
}
