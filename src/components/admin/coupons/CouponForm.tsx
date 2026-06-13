'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { FormField } from '@/components/common/FormField'
import { useT } from '@/lib/i18n/Provider'
import { apiPost, apiPut } from '@/lib/api'
import type { CouponFormProps, AdminCoupon } from '@/lib/types/admin'

// Convert a stored UTC ISO timestamp to the `datetime-local` input value
// (local wall-clock), so what the merchant sees matches what they saved.
// On submit `new Date(value).toISOString()` converts local → UTC, round-tripping.
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function CouponForm({ coupon, onSaved, onCancel }: CouponFormProps) {
  const t = useT()
  const isEdit = !!coupon

  const [code, setCode] = useState(coupon?.code ?? '')
  const [type, setType] = useState<'percentage' | 'fixed'>(coupon?.type ?? 'percentage')
  const [value, setValue] = useState(String(coupon?.value ?? ''))
  const [minOrderCents, setMinOrderCents] = useState(String(coupon?.minOrderCents ?? ''))
  const [maxDiscountCents, setMaxDiscountCents] = useState(String(coupon?.maxDiscountCents ?? ''))
  const [usageLimit, setUsageLimit] = useState(String(coupon?.usageLimit ?? ''))
  const [perCustomerLimit, setPerCustomerLimit] = useState(String(coupon?.perCustomerLimit ?? '1'))
  const [expiresAt, setExpiresAt] = useState(
    coupon?.expiresAt ? toLocalDatetimeInput(coupon.expiresAt) : '',
  )
  const [active, setActive] = useState(coupon?.active ?? true)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!code.trim()) {
      toast.error(t.errors.required.replace('{field}', t.admin.couponCode))
      return
    }
    if (!value || Number(value) <= 0) {
      toast.error(t.errors.required.replace('{field}', t.admin.couponValue))
      return
    }

    setSaving(true)
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        ...(minOrderCents ? { minOrderCents: Number(minOrderCents) } : {}),
        ...(maxDiscountCents ? { maxDiscountCents: Number(maxDiscountCents) } : {}),
        ...(usageLimit ? { usageLimit: Number(usageLimit) } : {}),
        perCustomerLimit: Number(perCustomerLimit) || 1,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        active,
      }

      if (isEdit && coupon) {
        await apiPut<AdminCoupon>(`/api/admin/coupons/${coupon.id}`, payload)
        toast.success(t.admin.couponUpdated)
      } else {
        await apiPost<AdminCoupon>('/api/admin/coupons', payload)
        toast.success(t.admin.couponCreated)
      }

      onSaved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.errors.networkError
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">{isEdit ? t.admin.editCoupon : t.admin.addCoupon}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label={t.admin.couponCode} htmlFor="coupon-code">
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t.admin.couponCodePlaceholder}
            disabled={isEdit}
          />
        </FormField>

        <FormField label={t.admin.couponType} htmlFor="coupon-type" help={t.tooltips.coupon.type}>
          <Select
            value={type}
            onValueChange={(v: string | null) => setType(v as 'percentage' | 'fixed')}
            disabled={isEdit}
          >
            <SelectTrigger id="coupon-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">{t.admin.couponTypePercentage}</SelectItem>
              <SelectItem value="fixed">{t.admin.couponTypeFixed}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField label={t.admin.couponValue} htmlFor="coupon-value" help={t.tooltips.coupon.value}>
        <Input
          id="coupon-value"
          type="number"
          min={1}
          max={type === 'percentage' ? 100 : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            type === 'percentage' ? t.admin.couponValuePercentHint : t.admin.couponValueFixedHint
          }
          disabled={isEdit}
        />
        <p className="text-xs text-muted-foreground">
          {type === 'percentage' ? t.admin.couponValuePercentHint : t.admin.couponValueFixedHint}
        </p>
      </FormField>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label={t.admin.minOrderCents}
          htmlFor="coupon-min-order"
          optional
          help={t.tooltips.coupon.minOrder}
        >
          <Input
            id="coupon-min-order"
            type="number"
            min={0}
            value={minOrderCents}
            onChange={(e) => setMinOrderCents(e.target.value)}
          />
        </FormField>

        <FormField
          label={t.admin.maxDiscountCents}
          htmlFor="coupon-max-discount"
          optional
          help={t.tooltips.coupon.maxDiscount}
        >
          <Input
            id="coupon-max-discount"
            type="number"
            min={1}
            value={maxDiscountCents}
            onChange={(e) => setMaxDiscountCents(e.target.value)}
          />
        </FormField>

        <FormField
          label={t.admin.usageLimit}
          htmlFor="coupon-usage-limit"
          optional
          help={t.tooltips.coupon.usageLimit}
        >
          <Input
            id="coupon-usage-limit"
            type="number"
            min={1}
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
          />
        </FormField>

        <FormField
          label={t.admin.perCustomerLimit}
          htmlFor="coupon-per-customer"
          help={t.tooltips.coupon.perCustomer}
        >
          <Input
            id="coupon-per-customer"
            type="number"
            min={1}
            value={perCustomerLimit}
            onChange={(e) => setPerCustomerLimit(e.target.value)}
          />
        </FormField>
      </div>

      <FormField
        label={t.admin.expiresAt}
        htmlFor="coupon-expires"
        optional
        help={t.tooltips.coupon.expiresAt}
      >
        <Input
          id="coupon-expires"
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          id="coupon-active"
          checked={active}
          onCheckedChange={(v: boolean) => setActive(v === true)}
        />
        <label htmlFor="coupon-active" className="text-sm cursor-pointer">
          {t.admin.active}
        </label>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving} className="w-full sm:w-auto">
          {saving ? t.admin.saving : t.admin.save}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {t.admin.cancel}
        </Button>
      </div>
    </form>
  )
}
