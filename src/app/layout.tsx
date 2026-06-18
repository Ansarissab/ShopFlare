import type * as React from 'react'
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Instrument_Serif, Noto_Nastaliq_Urdu } from 'next/font/google'
import '@/app/globals.css'
import { ServiceWorkerProvider } from '@/components/pwa/ServiceWorkerProvider'
import { JsonLd } from '@/components/shared/JsonLd'
import { organizationJsonLd } from '@/lib/seo/jsonld'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { serverWorkerUrl } from '@/lib/server/worker-origin'
import type { StoreConfig } from '@/lib/types/common'
import { DEFAULT_LOCALE, LOCALES } from '@/lib/constants'
import { getLocaleHeader } from '@/lib/i18n/server'
import { sanitizeHeadTags } from '@/lib/seo/headTags'
import { resolveSiteUrl } from '@/lib/seo/site-url'
import { ConsentProvider } from '@/lib/consent/ConsentProvider'
import { MarketingScripts } from '@/components/marketing/MarketingScripts'
import { CookieConsent } from '@/components/consent/CookieConsent'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})
// Design-system display font — used for h1–h4 via --font-display CSS variable.
// next/font self-hosts automatically; no external request at runtime.
const instrumentSerif = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})
// Urdu / RTL font — loaded only when the active locale is RTL to avoid bloat on LTR pages.
const notoNastaliq = Noto_Nastaliq_Urdu({
  variable: '--font-nastaliq',
  weight: ['400', '700'],
  subsets: ['arabic'],
  display: 'swap',
  preload: false,
})

// Dynamic store metadata — cached 5 min, fails gracefully when worker is unavailable.
export async function generateMetadata(): Promise<Metadata> {
  const workerUrl = serverWorkerUrl()
  // Resolve absolute site origin so metadataBase is always an absolute URL,
  // which causes Next.js to auto-absolutize all relative canonical/alternate hrefs.
  const siteUrl = await resolveSiteUrl()
  const metadataBase = siteUrl ? new URL(siteUrl) : undefined

  try {
    if (!workerUrl) throw new Error('no worker url')
    const res = await fetch(`${workerUrl}/api/config/store`, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error('config fetch failed')
    const config = (await res.json()) as {
      storeName?: string
      tagline?: string
      logoUrl?: string
      faviconUrl?: string
      googleSiteVerification?: string
      bingSiteVerification?: string
    }

    // Site verification — omit empties so no blank tags render.
    const verificationOther: Record<string, string> = {}
    if (config.bingSiteVerification) {
      verificationOther['msvalidate.01'] = config.bingSiteVerification
    }

    return {
      ...(metadataBase ? { metadataBase } : {}),
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
      verification: {
        google: config.googleSiteVerification || undefined,
        ...(Object.keys(verificationOther).length > 0 ? { other: verificationOther } : {}),
      },
    }
  } catch {
    return {
      ...(metadataBase ? { metadataBase } : {}),
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
  "var fnt={sans:'var(--font-geist-sans)',mono:'var(--font-geist-mono)'};",
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

const workerOrigin = serverWorkerUrl()

// ─── Custom head tag injection ─────────────────────────────────────────────────
// Parses a sanitizeHeadTags() output (guaranteed to contain only <meta> and
// <link> tags with safe attributes) into React elements. dangerouslySetInnerHTML
// is not used here — each tag is rendered as a proper React void element so
// Next.js App Router can hoist them correctly into <head> at SSR time.
// The sanitizeHeadTags() call upstream is always the XSS gate.
function inlineHeadTags(sanitized: string): React.ReactNode {
  if (!sanitized) return null
  // TAG_RE matches each <meta ...> or <link ...> tag from sanitizeHeadTags output.
  const TAG_RE = /<(meta|link)((?:\s+[^>]*)?)>/gi
  // ATTR_RE is non-global — re-applied per tag string, no lastIndex bleed.
  const ATTR_RE = /([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g
  const nodes: React.ReactElement[] = []
  let tagMatch: RegExpExecArray | null
  let i = 0
  while ((tagMatch = TAG_RE.exec(sanitized)) !== null) {
    const tag = tagMatch[1].toLowerCase() as 'meta' | 'link'
    const attrStr = tagMatch[2] ?? ''
    const props: Record<string, string> = {}
    // Reset lastIndex before each new attrStr so the global /g regex starts fresh.
    ATTR_RE.lastIndex = 0
    let attrMatch: RegExpExecArray | null
    while ((attrMatch = ATTR_RE.exec(attrStr)) !== null) {
      props[attrMatch[1]] = attrMatch[2]
    }
    nodes.push(tag === 'meta' ? <meta key={i++} {...props} /> : <link key={i++} {...props} />)
  }
  return nodes.length > 0 ? <>{nodes}</> : null
}

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

  // Use the EXPLICIT header locale (set by middleware when a /{locale} prefix is present).
  // Admin routes never carry the header, so they always get lang="en" dir="ltr".
  const locale = (await getLocaleHeader()) ?? DEFAULT_LOCALE
  const localeDir = LOCALES[locale].dir
  const isRtl = localeDir === 'rtl'

  const fontVars = [
    geistSans.variable,
    geistMono.variable,
    instrumentSerif.variable,
    // Include the Nastaliq variable only for RTL pages so no preload occurs on LTR.
    ...(isRtl ? [notoNastaliq.variable] : []),
  ].join(' ')

  // Sanitize admin-supplied head tags — always pass through the gate, never raw.
  const customHead = sanitizeHeadTags(config?.customHeadTags ?? '')

  // hasTags: at least one marketing ID is configured (drives banner + scripts).
  const hasTags = Boolean(config?.ga4MeasurementId || config?.googleAdsId || config?.metaPixelId)

  return (
    <html
      lang={locale}
      dir={localeDir}
      className={`${fontVars} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* No-flash theme boot: applies cached theme vars pre-paint */}
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        {/* Organization JSON-LD — sitewide entity anchor for structured data */}
        <JsonLd data={org} />
        {/* Sanitized merchant-supplied custom head tags (meta/link only; scripts stripped).
            sanitizeHeadTags() is the real XSS gate; only <meta> and <link> survive.
            Rendered as individual React elements via inlineHeadTags() so they become
            live <head> children. Never inject config.customHeadTags raw. */}
        {inlineHeadTags(customHead)}
        {/* Preconnect to worker/CDN origin (logo, product images, API) */}
        {workerOrigin && <link rel="preconnect" href={workerOrigin} />}
        {workerOrigin && <link rel="dns-prefetch" href={workerOrigin} />}
        {/* Demo seed images come from picsum.photos (external origin), so the LCP product
            image pays a fresh DNS/TLS handshake before it can load. Preconnect to set that
            up early. Real stores serve images from the worker /cdn (preconnected above), so
            this is a demo-only hint — harmless once real images replace the seed. Mirrors the
            demo-scoped rule in image-loader.ts. */}
        <link rel="preconnect" href="https://picsum.photos" />
        <link rel="dns-prefetch" href="https://picsum.photos" />
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
        <ConsentProvider>
          <ServiceWorkerProvider>{children}</ServiceWorkerProvider>
          <MarketingScripts
            ga4Id={config?.ga4MeasurementId ?? ''}
            googleAdsId={config?.googleAdsId ?? ''}
            metaPixelId={config?.metaPixelId ?? ''}
            cookieConsentEnabled={config?.cookieConsentEnabled ?? true}
          />
          <CookieConsent enabled={config?.cookieConsentEnabled ?? true} hasTags={hasTags} />
        </ConsentProvider>
      </body>
    </html>
  )
}
