'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { en } from '@/lib/i18n/en'
import { codOrderSchema, type CodOrder } from '@/lib/schemas'
import { useCart } from '@/hooks/useCart'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

type FormValues = CodOrder['shippingAddress']

export function CODForm() {
  const router = useRouter()
  const items = useCart((s) => s.items)
  const clearCart = useCart((s) => s.clearCart)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(codOrderSchema.shape.shippingAddress),
    defaultValues: { country: 'PK' },
  })

  async function onSubmit(shippingAddress: FormValues) {
    if (!turnstileToken) {
      toast.error(en.errors.required.replace('{field}', 'Security check'))
      return
    }

    const payload: CodOrder = {
      items: items.map((i) => ({ sizeOptionId: i.sizeOptionId, quantity: i.quantity })),
      shippingAddress,
    }

    try {
      const res = await fetch(`${WORKER_URL}/api/orders/cod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Turnstile-Token': turnstileToken,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message ?? 'Request failed')
      }

      const { orderId } = (await res.json()) as { orderId: string }
      clearCart()
      router.push(`/checkout/success?method=cod&orderId=${orderId}`)
    } catch {
      toast.error(en.errors.orderFailed)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {/* Full Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cod-name">{en.checkout.name}</Label>
        <Input
          id="cod-name"
          autoComplete="name"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-xs text-destructive">
            {en.errors.required.replace('{field}', en.checkout.name)}
          </p>
        )}
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cod-phone">{en.checkout.phone}</Label>
        <Input
          id="cod-phone"
          type="tel"
          autoComplete="tel"
          aria-invalid={!!errors.phone}
          {...register('phone')}
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{en.errors.invalidPhone}</p>
        )}
      </div>

      {/* Email (optional) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cod-email">
          {en.checkout.email}{' '}
          <span className="text-xs text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="cod-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{en.errors.invalidEmail}</p>
        )}
      </div>

      {/* Street Address */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cod-address">{en.checkout.address}</Label>
        <Input
          id="cod-address"
          autoComplete="street-address"
          aria-invalid={!!errors.address}
          {...register('address')}
        />
        {errors.address && (
          <p className="text-xs text-destructive">
            {en.errors.required.replace('{field}', en.checkout.address)}
          </p>
        )}
      </div>

      {/* City + State row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cod-city">{en.checkout.city}</Label>
          <Input
            id="cod-city"
            autoComplete="address-level2"
            aria-invalid={!!errors.city}
            {...register('city')}
          />
          {errors.city && (
            <p className="text-xs text-destructive">
              {en.errors.required.replace('{field}', en.checkout.city)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cod-state">
            {en.checkout.state}{' '}
            <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="cod-state"
            autoComplete="address-level1"
            {...register('state')}
          />
        </div>
      </div>

      {/* Postal Code + Country row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cod-postal">
            {en.checkout.postalCode}{' '}
            <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="cod-postal"
            autoComplete="postal-code"
            {...register('postalCode')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cod-country">{en.checkout.country}</Label>
          <Input
            id="cod-country"
            autoComplete="country"
            maxLength={2}
            aria-invalid={!!errors.country}
            {...register('country')}
          />
          {errors.country && (
            <p className="text-xs text-destructive">
              {en.errors.required.replace('{field}', en.checkout.country)}
            </p>
          )}
        </div>
      </div>

      {/* Turnstile */}
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
        <p className="text-xs text-destructive">Security check failed. Please refresh and try again.</p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || !turnstileToken}
      >
        {isSubmitting ? '...' : en.checkout.placeOrder}
      </Button>
    </form>
  )
}
