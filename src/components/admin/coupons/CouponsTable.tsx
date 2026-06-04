'use client'

import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'
import { apiDelete } from '@/lib/api'
import { formatDate } from '@/lib/utils/index'
import type { CouponRowProps, CouponsTableProps } from '@/lib/types/admin'

// ─── CouponRow ───────────────────────────────────────────────────────────────

function CouponRow({ coupon, onEdit, onDeleted }: CouponRowProps) {
  async function handleDelete() {
    if (!confirm(en.admin.deleteCouponConfirm)) return
    try {
      await apiDelete(`/api/admin/coupons/${coupon.id}`)
      toast.success(en.admin.couponDeleted)
      onDeleted()
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  const valueLabel =
    coupon.type === 'percentage' ? `${coupon.value}%` : `${coupon.value}¢`

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-mono text-xs font-semibold">{coupon.code}</td>
      <td className="px-4 py-3 text-sm">
        <span className="capitalize">{coupon.type === 'percentage' ? en.admin.couponTypePercentage : en.admin.couponTypeFixed}</span>
      </td>
      <td className="px-4 py-3 text-sm font-medium">{valueLabel}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {coupon.usedCount}
        {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {coupon.expiresAt
          ? formatDate(coupon.expiresAt)
          : '—'}
      </td>
      <td className="px-4 py-3">
        <Badge variant={coupon.active ? 'default' : 'secondary'}>
          {coupon.active ? en.admin.active : en.admin.inactive}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {coupon.stripeCouponId ? (
          <Badge variant="outline" className="text-xs">{en.admin.syncStripeCoupon}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => onEdit(coupon)}
            aria-label={en.admin.editCoupon}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            aria-label={en.admin.deleteCoupon}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// ─── CouponsTable ─────────────────────────────────────────────────────────────

export function CouponsTable({ coupons, onEdit, onDeleted }: CouponsTableProps) {
  if (coupons.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">{en.admin.noCoupons}</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {[
              en.admin.couponCode,
              en.admin.couponType,
              en.admin.couponValue,
              en.admin.usedCount,
              en.admin.expiresAt,
              en.admin.active,
              en.admin.stripeColumn,
              '',
            ].map((h, i) => (
              <th key={i} className="px-4 py-3 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <CouponRow
              key={coupon.id}
              coupon={coupon}
              onEdit={onEdit}
              onDeleted={onDeleted}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
