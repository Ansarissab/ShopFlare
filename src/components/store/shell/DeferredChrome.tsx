'use client'

// DeferredChrome — lazy-loads non-critical floating/hidden components off the
// initial hydration path so the main thread yields and the LCP image paints early.
// All six are ssr:false — none produce above-fold visible markup.

import dynamic from 'next/dynamic'

const AppHeader = dynamic(
  () => import('@/components/store/shell/AppHeader').then((m) => ({ default: m.AppHeader })),
  { ssr: false },
)

const AppTabBar = dynamic(
  () => import('@/components/store/shell/AppTabBar').then((m) => ({ default: m.AppTabBar })),
  { ssr: false },
)

const InstallPrompt = dynamic(
  () => import('@/components/pwa/InstallPrompt').then((m) => ({ default: m.InstallPrompt })),
  { ssr: false },
)

const OfflineBanner = dynamic(
  () => import('@/components/pwa/OfflineBanner').then((m) => ({ default: m.OfflineBanner })),
  { ssr: false },
)

const WhatsAppWidget = dynamic(
  () => import('@/components/store/WhatsAppWidget').then((m) => ({ default: m.WhatsAppWidget })),
  { ssr: false },
)

const StoreShortcuts = dynamic(
  () => import('@/components/store/StoreShortcuts').then((m) => ({ default: m.StoreShortcuts })),
  { ssr: false },
)

export function DeferredChrome() {
  return (
    <>
      <StoreShortcuts />
      <AppHeader />
      <AppTabBar />
      <InstallPrompt />
      <OfflineBanner />
      <WhatsAppWidget />
    </>
  )
}
