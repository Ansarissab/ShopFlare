'use client'

/* eslint-disable react-hooks/incompatible-library -- react-hook-form's watch() returns a
   function the React Compiler can't memoize; skipping memoization here is expected. */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/common/FormField'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { ReviewStars } from '@/components/store/product/ReviewStars'
import { submitReviewSchema, type SubmitReviewInput } from '@/lib/schemas'
import { apiPost, ApiError } from '@/lib/api'
import { useT } from '@/lib/i18n/Provider'
import type { ReviewFormProps } from '@/lib/types/product'

export function ReviewForm({ productId, onSubmitted }: ReviewFormProps) {
  const t = useT()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SubmitReviewInput>({
    resolver: zodResolver(submitReviewSchema),
    defaultValues: {
      productId,
      rating: 0,
      orderNumber: '',
      contact: '',
      customerName: '',
      body: '',
    },
  })

  const rating = watch('rating')

  async function onSubmit(values: SubmitReviewInput) {
    if (!turnstileToken) {
      toast.error(t.checkout.securityCheckFailed)
      return
    }

    try {
      await apiPost('/api/reviews', values, {
        headers: { 'X-Turnstile-Token': turnstileToken },
      })
      toast.success(t.reviews.submitted)
      reset()
      onSubmitted()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error(t.reviews.alreadyReviewed)
        } else if (err.status === 422) {
          toast.error(t.reviews.notEligible)
        } else if (err.status === 403) {
          toast.error(t.reviews.verifyFailed)
        } else {
          toast.error(t.reviews.submitFailed)
        }
      } else {
        toast.error(t.reviews.submitFailed)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input type="hidden" {...register('productId')} />

      {/* Verified-purchase section */}
      <div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
        <p className="text-sm font-medium">{t.reviews.verifyTitle}</p>
        <p className="text-xs text-muted-foreground">{t.reviews.verifyBody}</p>

        <FormField
          label={t.reviews.orderNumber}
          htmlFor="review-order-number"
          error={errors.orderNumber?.message}
        >
          <Input
            id="review-order-number"
            type="text"
            autoComplete="off"
            placeholder={t.reviews.orderNumberPlaceholder}
            aria-invalid={!!errors.orderNumber}
            {...register('orderNumber')}
          />
        </FormField>

        <FormField
          label={t.reviews.contact}
          htmlFor="review-contact"
          error={errors.contact?.message}
        >
          <Input
            id="review-contact"
            type="text"
            autoComplete="email"
            placeholder={t.reviews.contactPlaceholder}
            aria-invalid={!!errors.contact}
            {...register('contact')}
          />
        </FormField>
      </div>

      {/* Review content */}
      <FormField
        label={t.reviews.yourName}
        htmlFor="review-name"
        error={errors.customerName?.message}
      >
        <Input
          id="review-name"
          type="text"
          autoComplete="name"
          aria-invalid={!!errors.customerName}
          {...register('customerName')}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium leading-none">{t.reviews.yourRating}</span>
        <ReviewStars
          rating={rating}
          onChange={(r) => setValue('rating', r, { shouldValidate: true })}
        />
        {errors.rating && <p className="text-xs text-destructive">{t.reviews.ratingRequired}</p>}
      </div>

      <FormField
        label={t.reviews.yourReview}
        htmlFor="review-body"
        optional
        error={errors.body?.message}
      >
        <Textarea
          id="review-body"
          rows={4}
          placeholder={t.reviews.reviewPlaceholder}
          aria-invalid={!!errors.body}
          {...register('body')}
        />
      </FormField>

      {/* Turnstile */}
      {turnstileError ? (
        <p className="text-xs text-destructive">{t.checkout.securityCheckFailed}</p>
      ) : (
        <TurnstileWidget onVerify={setTurnstileToken} onError={() => setTurnstileError(true)} />
      )}

      <Button type="submit" disabled={isSubmitting || !turnstileToken} className="w-full">
        {isSubmitting ? t.reviews.submitting : t.reviews.submit}
      </Button>
    </form>
  )
}
