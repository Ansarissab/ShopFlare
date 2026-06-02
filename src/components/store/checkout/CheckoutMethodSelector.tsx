'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CODForm } from '@/components/store/checkout/CODForm'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { en, requiredMsg } from '@/lib/i18n/en'
import { useCart } from '@/hooks/useCart'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'

export function CheckoutMethodSelector() {
  const router = useRouter()
  const items = useCart((s) => s.items)
  const [stripeLoading, setStripeLoading] = useState(false)
  // Stripe checkout-session is Turnstile-gated server-side (it reserves stock),
  // so the card tab carries its own token just like the COD form.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)

  async function handleStripeCheckout() {
    if (!turnstileToken) {
      toast.error(requiredMsg('Security check'))
      return
    }
    setStripeLoading(true)
    try {
      const stripeItems = items
        .filter((i) => !!i.stripePriceId)
        .map((i) => ({ stripePriceId: i.stripePriceId!, quantity: i.quantity }))

      if (stripeItems.length === 0) {
        toast.error(en.errors.orderFailed)
        return
      }

      const { url } = await apiPost<{ url: string }>(
        '/api/stripe/checkout-session',
        { items: stripeItems },
        { headers: { 'X-Turnstile-Token': turnstileToken } },
      )
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
            {en.checkout.stripeRedirectNote}
          </p>
          <TurnstileWidget
            onVerify={(token) => {
              setTurnstileToken(token)
              setTurnstileError(false)
            }}
            onError={() => {
              setTurnstileToken(null)
              setTurnstileError(true)
            }}
          />
          {turnstileError && (
            <p className="text-xs text-destructive">{en.checkout.securityCheckFailed}</p>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={handleStripeCheckout}
            disabled={stripeLoading || !turnstileToken}
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
