'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { CheckoutMethodSelector } from '@/components/store/checkout/CheckoutMethodSelector'
import { OrderSummary } from '@/components/store/checkout/OrderSummary'
import { useT } from '@/lib/i18n/Provider'
import { useCart } from '@/hooks/useCart'

export default function CheckoutPage() {
  const t = useT()
  const router = useRouter()
  const items = useCart((s) => s.items)
  // Guard against Zustand persist hydration race: items is [] on the first
  // render before localStorage is read. Without this, the empty-cart redirect
  // fires immediately on every hard reload, sending users back to the homepage.
  // useSyncExternalStore seeds the mount flag without an effect-driven setState:
  // false on the server + first client render, true once hydrated/committed.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  useEffect(() => {
    if (!hydrated) return
    if (items.length === 0) router.replace('/')
  }, [hydrated, items.length, router])

  if (!hydrated || items.length === 0) return null

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <h1 className="mb-8 text-2xl font-bold tracking-tight">{t.checkout.title}</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_360px]">
        {/* Left: method selector + active form */}
        <section>
          <CheckoutMethodSelector />
        </section>

        {/* Right: order summary */}
        <aside className="order-first md:order-last">
          <OrderSummary />
        </aside>
      </div>
    </main>
  )
}
