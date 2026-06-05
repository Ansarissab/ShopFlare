'use client'

import { useState } from 'react'
import { CreditCard, Banknote, Building2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ManualOrderForm } from '@/components/store/checkout/ManualOrderForm'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { en, requiredMsg } from '@/lib/i18n/en'
import { useCart } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { cn } from '@/lib/utils'

type MethodValue = 'card' | 'cod' | 'bank' | 'whatsapp'

interface Method {
  value: MethodValue
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export function CheckoutMethodSelector() {
  const items = useCart((s) => s.items)
  const { config } = useStoreConfig()
  const [active, setActive] = useState<MethodValue>('cod')
  const [stripeLoading, setStripeLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)

  const bankEnabled = !!config?.bankAccountNumber

  const methods: Method[] = [
    { value: 'card',     label: en.checkout.payWithCard,      description: en.checkout.cardDescription,      icon: CreditCard },
    { value: 'cod',      label: en.store.cashOnDelivery,      description: en.checkout.codDescription,       icon: Banknote },
    ...(bankEnabled ? [{ value: 'bank' as const, label: en.checkout.bankTransfer, description: en.checkout.bankDescription, icon: Building2 }] : []),
    { value: 'whatsapp', label: en.store.orderOnWhatsApp,     description: en.checkout.whatsappDescription,  icon: MessageCircle },
  ]

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
      window.location.href = url
    } catch {
      toast.error(en.errors.orderFailed)
    } finally {
      setStripeLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Method selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {methods.map((m) => {
          const Icon = m.icon
          const selected = active === m.value
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setActive(m.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-4 flex-none items-center justify-center rounded-full border-2',
                  selected ? 'border-primary' : 'border-muted-foreground',
                )}
              >
                {selected && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <Icon className="size-4 flex-none mt-0.5 text-muted-foreground" aria-hidden />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-none">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.description}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Active form */}
      <div className="rounded-lg border p-4 sm:p-5">
        {active === 'card' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{en.checkout.stripeRedirectNote}</p>
            <TurnstileWidget
              onVerify={(token) => { setTurnstileToken(token); setTurnstileError(false) }}
              onError={() => { setTurnstileToken(null); setTurnstileError(true) }}
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
              {stripeLoading ? '…' : en.checkout.payWithCard}
            </Button>
          </div>
        )}

        {active === 'cod' && (
          <ManualOrderForm
            endpoint="/api/orders/cod"
            successMethod="cod"
            submitLabel={en.checkout.placeOrder}
          />
        )}

        {active === 'bank' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{en.checkout.bankTransferNote}</p>
            <ManualOrderForm
              endpoint="/api/orders/bank-transfer"
              successMethod="bank_transfer"
              submitLabel={en.checkout.placeOrder}
            />
          </div>
        )}

        {active === 'whatsapp' && (
          <p className="text-sm text-muted-foreground">
            WhatsApp ordering is available directly on each product page. Visit the product you
            want and tap &ldquo;{en.store.orderOnWhatsApp}&rdquo; to send your order.
          </p>
        )}
      </div>
    </div>
  )
}
