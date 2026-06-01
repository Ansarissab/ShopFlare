'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CODForm } from '@/components/store/checkout/CODForm'
import { en } from '@/lib/i18n/en'
import { useCart } from '@/hooks/useCart'
import { toast } from 'sonner'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

export function CheckoutMethodSelector() {
  const router = useRouter()
  const items = useCart((s) => s.items)
  const [stripeLoading, setStripeLoading] = useState(false)

  async function handleStripeCheckout() {
    setStripeLoading(true)
    try {
      const stripeItems = items
        .filter((i) => !!i.stripePriceId)
        .map((i) => ({ stripePriceId: i.stripePriceId!, quantity: i.quantity }))

      if (stripeItems.length === 0) {
        toast.error(en.errors.orderFailed)
        return
      }

      const res = await fetch(`${WORKER_URL}/api/stripe/checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: stripeItems }),
      })

      if (!res.ok) throw new Error('Failed to create checkout session')

      const { url } = (await res.json()) as { url: string }
      router.push(url)
    } catch {
      toast.error(en.errors.orderFailed)
    } finally {
      setStripeLoading(false)
    }
  }

  return (
    <Tabs defaultValue="cod" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="card">{en.checkout.payWithCard}</TabsTrigger>
        <TabsTrigger value="cod">{en.store.cashOnDelivery}</TabsTrigger>
        <TabsTrigger value="whatsapp">{en.store.orderOnWhatsApp}</TabsTrigger>
      </TabsList>

      {/* Stripe card tab */}
      <TabsContent value="card" className="pt-4">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            You will be redirected to Stripe&apos;s secure payment page.
          </p>
          <Button
            size="lg"
            className="w-full"
            onClick={handleStripeCheckout}
            disabled={stripeLoading}
          >
            {stripeLoading ? '...' : en.checkout.payWithCard}
          </Button>
        </div>
      </TabsContent>

      {/* COD tab */}
      <TabsContent value="cod" className="pt-4">
        <CODForm />
      </TabsContent>

      {/* WhatsApp tab */}
      <TabsContent value="whatsapp" className="pt-4">
        <p className="text-sm text-muted-foreground">
          WhatsApp ordering is available directly on each product page. Visit the product you
          want and tap &ldquo;{en.store.orderOnWhatsApp}&rdquo; to send your order.
        </p>
      </TabsContent>
    </Tabs>
  )
}
