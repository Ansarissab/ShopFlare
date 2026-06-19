import type { Metadata } from 'next'
import { Suspense } from 'react'
import { StorefrontHeader } from '@/components/store/StorefrontHeader'
import { StorefrontFooter } from '@/components/store/StorefrontFooter'
import { ThemeProvider } from '@/components/store/ThemeProvider'
import { AnnouncementBar } from '@/components/store/AnnouncementBar'
import { SearchProvider } from '@/components/store/search/SearchProvider'
import { DeferredChrome } from '@/components/store/shell/DeferredChrome'
import { TProvider } from '@/lib/i18n/Provider'
import { getLocaleHeader } from '@/lib/i18n/server'
import { DEFAULT_LOCALE, LOCALES } from '@/lib/constants'

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Middleware is the single source of locale truth — it sets x-locale from the
  // URL prefix, else the NEXT_LOCALE cookie, else nothing. We just read it here.
  const locale = (await getLocaleHeader()) ?? DEFAULT_LOCALE

  const localeDir = LOCALES[locale].dir

  return (
    <TProvider locale={locale}>
      {/* dir/lang on the outermost store wrapper so RTL flips even when
          the root <html> stays "en" (unprefixed + merchant defaultLocale case). */}
      <ThemeProvider>
        {/* SearchProvider wraps the store chrome so StorefrontHeader's
            useSearchOverlay() works and the lazy overlay mounts once. */}
        <SearchProvider>
          {/* flex flex-col flex-1 reproduces the body's column context so the
              inner <main className="flex-1"> still expands (sticky footer). */}
          <div dir={localeDir} lang={locale} className="flex flex-1 flex-col">
            {/* Web browser chrome — hidden via CSS when running in standalone mode */}
            <div data-web-chrome>
              <AnnouncementBar />
              <StorefrontHeader />
            </div>
            {/* Suspense boundary so client pages using useSearchParams (home/search,
                category, tracking, checkout success) can statically prerender a shell. */}
            <main className="flex-1">
              <Suspense fallback={null}>{children}</Suspense>
            </main>
            <div data-web-chrome>
              <StorefrontFooter />
            </div>
            {/* Deferred: PWA chrome, keyboard shortcuts, floating widgets — all
                hidden/headless; lazy-loaded off the critical hydration path. */}
            <DeferredChrome />
          </div>
        </SearchProvider>
      </ThemeProvider>
    </TProvider>
  )
}
