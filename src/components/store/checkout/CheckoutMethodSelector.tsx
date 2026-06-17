'use client'

import { useState, useRef } from 'react'
import { CreditCard, Banknote, Building2, MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ManualOrderForm } from '@/components/store/checkout/ManualOrderForm'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { useT } from '@/lib/i18n/Provider'
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
  const t = useT()
  const items = useCart((s) => s.items)
  const { config } = useStoreConfig()
  const [active, setActive] = useState<MethodValue>('cod')
  const [stripeLoading, setStripeLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const radioRefs = useRef<Map<MethodValue, HTMLButtonElement | null>>(new Map())

  const bankEnabled = !!config?.bankAccountNumber

  const methods: Method[] = [
    {
      value: 'card',
      label: t.checkout.payWithCard,
      description: t.checkout.cardDescription,
      icon: CreditCard,
    },
    {
      value: 'cod',
      label: t.store.cashOnDelivery,
      description: t.checkout.codDescription,
      icon: Banknote,
    },
    ...(bankEnabled
      ? [
          {
            value: 'bank' as const,
            label: t.checkout.bankTransfer,
            description: t.checkout.bankDescription,
            icon: Building2,
          },
        ]
      : []),
    {
      value: 'whatsapp',
      label: t.store.orderOnWhatsApp,
      description: t.checkout.whatsappDescription,
      icon: MessageCircle,
    },
  ]

  const handleRadioKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentValue: MethodValue,
  ) => {
    const methodValues = methods.map((m) => m.value)
    const idx = methodValues.indexOf(currentValue)
    let nextIdx: number | null = null

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % methodValues.length
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + methodValues.length) % methodValues.length
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = methodValues.length - 1
    }

    if (nextIdx !== null) {
      e.preventDefault()
      const nextValue = methodValues[nextIdx]
      setActive(nextValue)
      radioRefs.current.get(nextValue)?.focus()
    }
  }

  async function handleStripeCheckout() {
    if (!turnstileToken) {
      toast.error(t.errors.required.replace('{field}', 'Security check'))
      return
    }
    setStripeLoading(true)
    try {
      const stripeItems = items
        .filter((i) => !!i.stripePriceId)
        .map((i) => ({ stripePriceId: i.stripePriceId!, quantity: i.quantity }))

      if (stripeItems.length === 0) {
        toast.error(t.errors.orderFailed)
        return
      }

      const { url } = await apiPost<{ url: string }>(
        '/api/stripe/checkout-session',
        { items: stripeItems },
        { headers: { 'X-Turnstile-Token': turnstileToken } },
      )
      window.location.href = url
    } catch {
      toast.error(t.errors.orderFailed)
    } finally {
      setStripeLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Method selector — behaves as a radio group */}
      <div
        role="radiogroup"
        aria-label={t.checkout.paymentMethodLegend}
        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        {methods.map((m) => {
          const Icon = m.icon
          const selected = active === m.value
          return (
            <button
              key={m.value}
              ref={(el) => {
                radioRefs.current.set(m.value, el)
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(m.value)}
              onKeyDown={(e) => handleRadioKeyDown(e, m.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-start transition-colors',
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
            <p className="text-sm text-muted-foreground">{t.checkout.stripeRedirectNote}</p>
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
              <p className="text-xs text-destructive">{t.checkout.securityCheckFailed}</p>
            )}
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleStripeCheckout}
              disabled={stripeLoading || !turnstileToken}
              aria-busy={stripeLoading}
            >
              {stripeLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t.checkout.processingOrder}
                </>
              ) : (
                t.checkout.payWithCard
              )}
            </Button>
          </div>
        )}

        {active === 'cod' && (
          <ManualOrderForm
            endpoint="/api/orders/cod"
            successMethod="cod"
            submitLabel={t.checkout.placeOrder}
          />
        )}

        {active === 'bank' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t.checkout.bankTransferNote}</p>
            <ManualOrderForm
              endpoint="/api/orders/bank-transfer"
              successMethod="bank_transfer"
              submitLabel={t.checkout.placeOrder}
            />
          </div>
        )}

        {active === 'whatsapp' && (
          <p className="text-sm text-muted-foreground">
            {t.checkout.whatsappPanelNote.replace('{action}', t.store.orderOnWhatsApp)}
          </p>
        )}
      </div>
    </div>
  )
}
