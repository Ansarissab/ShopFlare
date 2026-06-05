'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ManualOrderForm } from '@/components/store/checkout/ManualOrderForm'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { en, requiredMsg } from '@/lib/i18n/en'
import { useCart } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'

export function CheckoutMethodSelector() {
  const items = useCart((s) => s.items)
  const { config } = useStoreConfig()
  const [stripeLoading, setStripeLoading] = useState(false)
  // Stripe checkout-session is Turnstile-gated server-side (it reserves stock),
  // so the card tab carries its own token just like the manual order forms.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)

  // Bank Transfer only appears once the merchant has configured an account number.
  const bankEnabled = !!config?.bankAccountNumber

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
      // Stripe checkout URL is external — router.push() only handles internal routes.
      window.location.href = url
    } catch {
      toast.error(en.errors.orderFailed)
    } finally {
      setStripeLoading(false)
    }
  }

  // Tab count is dynamic (Bank Transfer is conditional), so size the grid to match.
  const tabCount = bankEnabled ? 4 : 3

  return (
    <Tabs defaultValue="cod" className="w-full">
      <TabsList className={cn('grid w-full', tabCount === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3')}>
        <TabsTrigger value="card" className="text-xs sm:text-sm">{en.checkout.payWithCard}</TabsTrigger>
        <TabsTrigger value="cod" className="text-xs sm:text-sm">{en.store.cashOnDelivery}</TabsTrigger>
        {bankEnabled && <TabsTrigger value="bank" className="text-xs sm:text-sm">{en.checkout.bankTransfer}</TabsTrigger>}
        <TabsTrigger value="whatsapp" className="text-xs sm:text-sm">{en.store.orderOnWhatsApp}</TabsTrigger>
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
        <ManualOrderForm
          endpoint="/api/orders/cod"
          successMethod="cod"
          submitLabel={en.checkout.placeOrder}
        />
      </TabsContent>

      {/* Bank Transfer tab */}
      {bankEnabled && (
        <TabsContent value="bank" className="pt-4">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{en.checkout.bankTransferNote}</p>
            <ManualOrderForm
              endpoint="/api/orders/bank-transfer"
              successMethod="bank_transfer"
              submitLabel={en.checkout.placeOrder}
            />
          </div>
        </TabsContent>
      )}

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
