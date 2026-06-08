import type { Metadata } from 'next'
import { Suspense } from 'react'
import { StorefrontHeader } from '@/components/store/StorefrontHeader'
import { StorefrontFooter } from '@/components/store/StorefrontFooter'
import { ThemeProvider } from '@/components/store/ThemeProvider'
import { AppHeader } from '@/components/store/shell/AppHeader'
import { AppTabBar } from '@/components/store/shell/AppTabBar'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { OfflineBanner } from '@/components/pwa/OfflineBanner'
import { WhatsAppWidget } from '@/components/store/WhatsAppWidget'

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {/* Web browser chrome — hidden via CSS when running in standalone mode */}
      <div data-web-chrome>
        <StorefrontHeader />
      </div>
      {/* Native app chrome — visible only in standalone (AppHeader/AppTabBar self-hide in browser) */}
      <AppHeader />
      {/* Suspense boundary so client pages using useSearchParams (home/search,
          category, tracking, checkout success) can statically prerender a shell. */}
      <main className="flex-1">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      <div data-web-chrome>
        <StorefrontFooter />
      </div>
      <AppTabBar />
      <InstallPrompt />
      <OfflineBanner />
      <WhatsAppWidget />
    </ThemeProvider>
  )
}
