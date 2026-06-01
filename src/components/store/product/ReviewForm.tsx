'use client'

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
import { en } from '@/lib/i18n/en'
import type { ReviewFormProps } from '@/lib/types/store'

export function ReviewForm({ productId, onSubmitted }: ReviewFormProps) {
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
      toast.error(en.checkout.securityCheckFailed)
      return
    }

    try {
      await apiPost('/api/reviews', values, {
        headers: { 'X-Turnstile-Token': turnstileToken },
      })
      toast.success(en.reviews.submitted)
      reset()
      onSubmitted()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error(en.reviews.alreadyReviewed)
        } else if (err.status === 422) {
          toast.error(en.reviews.notEligible)
        } else if (err.status === 403) {
          toast.error(en.reviews.verifyFailed)
        } else {
          toast.error(en.reviews.submitFailed)
        }
      } else {
        toast.error(en.reviews.submitFailed)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input type="hidden" {...register('productId')} />

      {/* Verified-purchase section */}
      <div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
        <p className="text-sm font-medium">{en.reviews.verifyTitle}</p>
        <p className="text-xs text-muted-foreground">{en.reviews.verifyBody}</p>

        <FormField
          label={en.reviews.orderNumber}
          htmlFor="review-order-number"
          error={errors.orderNumber?.message}
        >
          <Input
            id="review-order-number"
            type="text"
            autoComplete="off"
            placeholder="ORD-…"
            aria-invalid={!!errors.orderNumber}
            {...register('orderNumber')}
          />
        </FormField>

        <FormField
          label={en.reviews.contact}
          htmlFor="review-contact"
          error={errors.contact?.message}
        >
          <Input
            id="review-contact"
            type="text"
            autoComplete="email"
            placeholder="you@example.com or +1 555…"
            aria-invalid={!!errors.contact}
            {...register('contact')}
          />
        </FormField>
      </div>

      {/* Review content */}
      <FormField
        label={en.reviews.yourName}
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
        <span className="text-sm font-medium leading-none">{en.reviews.yourRating}</span>
        <ReviewStars
          rating={rating}
          onChange={(r) => setValue('rating', r, { shouldValidate: true })}
        />
        {errors.rating && (
          <p className="text-xs text-destructive">{en.reviews.ratingRequired}</p>
        )}
      </div>

      <FormField
        label={en.reviews.yourReview}
        htmlFor="review-body"
        optional
        error={errors.body?.message}
      >
        <Textarea
          id="review-body"
          rows={4}
          placeholder={en.reviews.reviewPlaceholder}
          aria-invalid={!!errors.body}
          {...register('body')}
        />
      </FormField>

      {/* Turnstile */}
      {turnstileError ? (
        <p className="text-xs text-destructive">{en.checkout.securityCheckFailed}</p>
      ) : (
        <TurnstileWidget
          onVerify={setTurnstileToken}
          onError={() => setTurnstileError(true)}
        />
      )}

      <Button type="submit" disabled={isSubmitting || !turnstileToken} className="w-full">
        {isSubmitting ? en.reviews.submitting : en.reviews.submit}
      </Button>
    </form>
  )
}
