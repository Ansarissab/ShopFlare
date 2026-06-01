'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckoutMethodSelector } from '@/components/store/checkout/CheckoutMethodSelector'
import { OrderSummary } from '@/components/store/checkout/OrderSummary'
import { en } from '@/lib/i18n/en'
import { useCart } from '@/hooks/useCart'

export default function CheckoutPage() {
  const router = useRouter()
  const items = useCart((s) => s.items)

  // Redirect to home if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.replace('/')
    }
  }, [items.length, router])

  if (items.length === 0) return null

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <h1 className="mb-8 text-2xl font-bold tracking-tight">{en.checkout.title}</h1>

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
