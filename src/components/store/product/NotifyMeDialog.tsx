'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
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
import { notifyMeSchema } from '@/lib/schemas'
import { en } from '@/lib/i18n/en'

type NotifyMeFormValues = z.infer<typeof notifyMeSchema>

interface NotifyMeDialogProps {
  sizeOptionId: string
  productName: string
  size: string
  variantLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

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
  } = useForm<NotifyMeFormValues>({
    resolver: zodResolver(notifyMeSchema),
    defaultValues: {
      sizeOptionId,
      email: '',
      phone: '',
    },
  })

  async function onSubmit(values: NotifyMeFormValues) {
    try {
      const res = await fetch(`${WORKER_URL}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sizeOptionId: values.sizeOptionId,
          ...(values.email ? { email: values.email } : {}),
          ...(values.phone ? { phone: values.phone } : {}),
        }),
      })

      if (!res.ok) throw new Error('non-2xx response')

      toast.success("You'll be notified when it's back in stock!")
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
            <strong>{variantLabel} / {size}</strong>
            {" is back in stock."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <input type="hidden" {...register('sizeOptionId')} />

          <div className="space-y-2">
            <Label htmlFor="notify-email">{en.checkout.email}</Label>
            <Input
              id="notify-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{en.errors.invalidEmail}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notify-phone">{en.checkout.phone}</Label>
            <Input
              id="notify-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 000 0000"
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{en.errors.invalidPhone}</p>
            )}
          </div>

          {errors.root && (
            <p className="text-sm text-destructive">{errors.root.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {en.store.notifyMe}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
