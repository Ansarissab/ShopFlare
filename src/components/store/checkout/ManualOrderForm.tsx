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
import type { ManualOrderFormProps } from '@/lib/types/store'

type FormValues = CodOrder['shippingAddress']

/**
 * Shipping-address + Turnstile order form for the manual payment paths (COD and
 * Bank Transfer). The two only differ by the endpoint they POST to and the
 * `method` they pass to the success page, so the form lives here once.
 */
export function ManualOrderForm({ endpoint, successMethod, submitLabel }: ManualOrderFormProps) {
  const router = useRouter()
  const items = useCart((s) => s.items)
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
      const { orderNumber } = await apiPost<{ orderId: string; orderNumber: string }>(
        endpoint,
        payload,
        { headers: { 'X-Turnstile-Token': turnstileToken } },
      )
      // clearCart is called by the success page via useEffect — calling it here first
      // empties the cart and triggers CheckoutPage's empty-cart redirect to /, which
      // races with router.push and can land the user on the homepage.
      router.push(`/checkout/success?method=${successMethod}&orderId=${orderNumber}`)
    } catch {
      toast.error(en.errors.orderFailed)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {/* Full Name */}
      <FormField label={en.checkout.name} htmlFor="ship-name" error={errors.name ? requiredMsg(en.checkout.name) : undefined}>
        <Input id="ship-name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
      </FormField>

      {/* Phone */}
      <FormField label={en.checkout.phone} htmlFor="ship-phone" error={errors.phone ? en.errors.invalidPhone : undefined}>
        <Input id="ship-phone" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} {...register('phone')} />
      </FormField>

      {/* Email (optional) */}
      <FormField label={en.checkout.email} htmlFor="ship-email" optional error={errors.email ? en.errors.invalidEmail : undefined}>
        <Input id="ship-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
      </FormField>

      {/* Street Address */}
      <FormField label={en.checkout.address} htmlFor="ship-address" error={errors.address ? requiredMsg(en.checkout.address) : undefined}>
        <Input id="ship-address" autoComplete="street-address" aria-invalid={!!errors.address} {...register('address')} />
      </FormField>

      {/* City + State row */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={en.checkout.city} htmlFor="ship-city" error={errors.city ? requiredMsg(en.checkout.city) : undefined}>
          <Input id="ship-city" autoComplete="address-level2" aria-invalid={!!errors.city} {...register('city')} />
        </FormField>

        <FormField label={en.checkout.state} htmlFor="ship-state" optional>
          <Input id="ship-state" autoComplete="address-level1" {...register('state')} />
        </FormField>
      </div>

      {/* Postal Code + Country row */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label={en.checkout.postalCode} htmlFor="ship-postal" optional>
          <Input id="ship-postal" autoComplete="postal-code" {...register('postalCode')} />
        </FormField>

        <FormField label={en.checkout.country} htmlFor="ship-country" error={errors.country ? requiredMsg(en.checkout.country) : undefined}>
          <Input id="ship-country" autoComplete="country" maxLength={2} aria-invalid={!!errors.country} {...register('country')} />
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
        <p className="text-xs text-destructive">{en.checkout.securityCheckFailed}</p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !turnstileToken}>
        {isSubmitting ? '...' : submitLabel}
      </Button>
    </form>
  )
}
