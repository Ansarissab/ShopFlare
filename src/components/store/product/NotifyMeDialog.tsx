'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notifyMeSchema, type NotifyMeInput } from '@/lib/schemas'
import { en } from '@/lib/i18n/en'
import type { NotifyMeDialogProps } from '@/lib/types/product'
import { apiPost } from '@/lib/api'

export function NotifyMeDialog({
  sizeOptionId,
  productName: _productName,
  size,
  variantLabel,
  open,
  onOpenChange,
}: NotifyMeDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<NotifyMeInput>({
    resolver: zodResolver(notifyMeSchema),
    defaultValues: {
      sizeOptionId,
      email: '',
      phone: '',
    },
  })

  async function onSubmit(values: NotifyMeInput) {
    try {
      await apiPost('/api/notify', {
        sizeOptionId: values.sizeOptionId,
        ...(values.email ? { email: values.email } : {}),
        ...(values.phone ? { phone: values.phone } : {}),
      })

      toast.success(en.store.notifySuccess)
      reset()
      onOpenChange(false)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{en.store.notifyMe}</DialogTitle>
          <DialogDescription>
            {"We'll let you know when "}
            <strong>
              {variantLabel} / {size}
            </strong>
            {' is back in stock.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
          <input type="hidden" {...register('sizeOptionId')} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="notify-email">{en.checkout.email}</Label>
            <Input
              id="notify-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-destructive">{en.errors.invalidEmail}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notify-phone">{en.checkout.phone}</Label>
            <Input
              id="notify-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 000 0000"
              aria-invalid={!!errors.phone}
              {...register('phone')}
            />
            {errors.phone && <p className="text-sm text-destructive">{en.errors.invalidPhone}</p>}
          </div>

          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {en.store.notifyMe}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
