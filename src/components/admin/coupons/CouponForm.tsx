'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { FormField } from '@/components/common/FormField'
import { en } from '@/lib/i18n/en'
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
  const isEdit = !!coupon

  const [code, setCode] = useState(coupon?.code ?? '')
  const [type, setType] = useState<'percentage' | 'fixed'>(coupon?.type ?? 'percentage')
  const [value, setValue] = useState(String(coupon?.value ?? ''))
  const [minOrderCents, setMinOrderCents] = useState(String(coupon?.minOrderCents ?? ''))
  const [maxDiscountCents, setMaxDiscountCents] = useState(String(coupon?.maxDiscountCents ?? ''))
  const [usageLimit, setUsageLimit] = useState(String(coupon?.usageLimit ?? ''))
  const [perCustomerLimit, setPerCustomerLimit] = useState(String(coupon?.perCustomerLimit ?? '1'))
  const [expiresAt, setExpiresAt] = useState(coupon?.expiresAt ? toLocalDatetimeInput(coupon.expiresAt) : '')
  const [active, setActive] = useState(coupon?.active ?? true)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!code.trim()) {
      toast.error(en.errors.required.replace('{field}', en.admin.couponCode))
      return
    }
    if (!value || Number(value) <= 0) {
      toast.error(en.errors.required.replace('{field}', en.admin.couponValue))
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
        toast.success(en.admin.couponUpdated)
      } else {
        await apiPost<AdminCoupon>('/api/admin/coupons', payload)
        toast.success(en.admin.couponCreated)
      }

      onSaved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : en.errors.networkError
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">{isEdit ? en.admin.editCoupon : en.admin.addCoupon}</h2>

      <div className="grid grid-cols-2 gap-3">
        <FormField label={en.admin.couponCode} htmlFor="coupon-code">
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={en.admin.couponCodePlaceholder}
            disabled={isEdit}
          />
        </FormField>

        <FormField label={en.admin.couponType} htmlFor="coupon-type">
          <Select
            value={type}
            onValueChange={(v) => setType(v as 'percentage' | 'fixed')}
            disabled={isEdit}
          >
            <SelectTrigger id="coupon-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">{en.admin.couponTypePercentage}</SelectItem>
              <SelectItem value="fixed">{en.admin.couponTypeFixed}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField
        label={en.admin.couponValue}
        htmlFor="coupon-value"
      >
        <Input
          id="coupon-value"
          type="number"
          min={1}
          max={type === 'percentage' ? 100 : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === 'percentage' ? en.admin.couponValuePercentHint : en.admin.couponValueFixedHint}
          disabled={isEdit}
        />
        <p className="text-xs text-muted-foreground">
          {type === 'percentage' ? en.admin.couponValuePercentHint : en.admin.couponValueFixedHint}
        </p>
      </FormField>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <FormField label={en.admin.minOrderCents} htmlFor="coupon-min-order" optional>
          <Input
            id="coupon-min-order"
            type="number"
            min={0}
            value={minOrderCents}
            onChange={(e) => setMinOrderCents(e.target.value)}
          />
        </FormField>

        <FormField label={en.admin.maxDiscountCents} htmlFor="coupon-max-discount" optional>
          <Input
            id="coupon-max-discount"
            type="number"
            min={1}
            value={maxDiscountCents}
            onChange={(e) => setMaxDiscountCents(e.target.value)}
          />
        </FormField>

        <FormField label={en.admin.usageLimit} htmlFor="coupon-usage-limit" optional>
          <Input
            id="coupon-usage-limit"
            type="number"
            min={1}
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
          />
        </FormField>

        <FormField label={en.admin.perCustomerLimit} htmlFor="coupon-per-customer">
          <Input
            id="coupon-per-customer"
            type="number"
            min={1}
            value={perCustomerLimit}
            onChange={(e) => setPerCustomerLimit(e.target.value)}
          />
        </FormField>
      </div>

      <FormField label={en.admin.expiresAt} htmlFor="coupon-expires" optional>
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
          onCheckedChange={(v) => setActive(v === true)}
        />
        <label htmlFor="coupon-active" className="text-sm cursor-pointer">
          {en.admin.active}
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? en.admin.saving : en.admin.save}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          {en.admin.cancel}
        </Button>
      </div>
    </form>
  )
}
