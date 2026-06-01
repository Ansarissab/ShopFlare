'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { FormField } from '@/components/common/FormField'
import { en, requiredMsg } from '@/lib/i18n/en'
import { codOrderSchema, type CodOrder } from '@/lib/schemas'
import { useCart } from '@/hooks/useCart'
import { apiPost } from '@/lib/api'

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
      toast.error(requiredMsg('Security check'))
      return
    }

    const payload: CodOrder = {
      items: items.map((i) => ({ sizeOptionId: i.sizeOptionId, quantity: i.quantity })),
      shippingAddress,
    }

    try {
      const { orderId } = await apiPost<{ orderId: string }>(
        '/api/orders/cod',
        payload,
        { headers: { 'X-Turnstile-Token': turnstileToken } },
      )
      clearCart()
      router.push(`/checkout/success?method=cod&orderId=${orderId}`)
    } catch {
      toast.error(en.errors.orderFailed)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {/* Full Name */}
      <FormField label={en.checkout.name} htmlFor="cod-name" error={errors.name ? requiredMsg(en.checkout.name) : undefined}>
        <Input
          id="cod-name"
          autoComplete="name"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
      </FormField>

      {/* Phone */}
      <FormField label={en.checkout.phone} htmlFor="cod-phone" error={errors.phone ? en.errors.invalidPhone : undefined}>
        <Input
          id="cod-phone"
          type="tel"
          autoComplete="tel"
          aria-invalid={!!errors.phone}
          {...register('phone')}
        />
      </FormField>

      {/* Email (optional) */}
      <FormField label={en.checkout.email} htmlFor="cod-email" optional error={errors.email ? en.errors.invalidEmail : undefined}>
        <Input
          id="cod-email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
      </FormField>

      {/* Street Address */}
      <FormField label={en.checkout.address} htmlFor="cod-address" error={errors.address ? requiredMsg(en.checkout.address) : undefined}>
        <Input
          id="cod-address"
          autoComplete="street-address"
          aria-invalid={!!errors.address}
          {...register('address')}
        />
      </FormField>

      {/* City + State row */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={en.checkout.city} htmlFor="cod-city" error={errors.city ? requiredMsg(en.checkout.city) : undefined}>
          <Input
            id="cod-city"
            autoComplete="address-level2"
            aria-invalid={!!errors.city}
            {...register('city')}
          />
        </FormField>

        <FormField label={en.checkout.state} htmlFor="cod-state" optional>
          <Input
            id="cod-state"
            autoComplete="address-level1"
            {...register('state')}
          />
        </FormField>
      </div>

      {/* Postal Code + Country row */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={en.checkout.postalCode} htmlFor="cod-postal" optional>
          <Input
            id="cod-postal"
            autoComplete="postal-code"
            {...register('postalCode')}
          />
        </FormField>

        <FormField label={en.checkout.country} htmlFor="cod-country" error={errors.country ? requiredMsg(en.checkout.country) : undefined}>
          <Input
            id="cod-country"
            autoComplete="country"
            maxLength={2}
            aria-invalid={!!errors.country}
            {...register('country')}
          />
        </FormField>
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
