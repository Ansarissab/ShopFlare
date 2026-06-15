'use client'

import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HelpTip } from '@/components/common/HelpTip'
import { useT } from '@/lib/i18n/Provider'
import { apiDelete } from '@/lib/api'
import { formatDate } from '@/lib/utils/index'
import { cn } from '@/lib/utils'
import { useListNavigation } from '@/hooks/useListNavigation'
import { useRegisterListNav } from '@/components/admin/shared/ListNavContext'
import type { CouponRowProps, CouponsTableProps } from '@/lib/types/admin'

// ─── CouponRow ───────────────────────────────────────────────────────────────

function CouponRow({ coupon, onEdit, onDeleted, active }: CouponRowProps & { active?: boolean }) {
  const t = useT()
  async function handleDelete() {
    if (!confirm(t.admin.deleteCouponConfirm)) return
    try {
      await apiDelete(`/api/admin/coupons/${coupon.id}`)
      toast.success(t.admin.couponDeleted)
      onDeleted()
    } catch {
      toast.error(t.errors.networkError)
    }
  }

  const valueLabel = coupon.type === 'percentage' ? `${coupon.value}%` : `${coupon.value}¢`

  return (
    <tr
      className={cn(
        'border-b last:border-0 hover:bg-muted/30 transition-colors',
        active && 'bg-muted ring-1 ring-inset ring-ring',
      )}
    >
      <td className="px-4 py-3 font-mono text-xs font-semibold">{coupon.code}</td>
      <td className="hidden sm:table-cell px-4 py-3 text-sm">
        <span className="capitalize">
          {coupon.type === 'percentage' ? t.admin.couponTypePercentage : t.admin.couponTypeFixed}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium">{valueLabel}</td>
      <td className="hidden sm:table-cell px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
        {coupon.usedCount}
        {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}
      </td>
      <td className="hidden sm:table-cell px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {coupon.expiresAt ? formatDate(coupon.expiresAt) : '—'}
      </td>
      <td className="px-4 py-3">
        <Badge variant={coupon.active ? 'default' : 'secondary'}>
          {coupon.active ? t.admin.active : t.admin.inactive}
        </Badge>
      </td>
      <td className="hidden sm:table-cell px-4 py-3">
        {coupon.stripeCouponId ? (
          <Badge variant="outline" className="text-xs">
            {t.admin.syncStripeCoupon}
          </Badge>
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
            aria-label={t.admin.editCoupon}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            aria-label={t.admin.deleteCoupon}
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
  const t = useT()

  const { next, prev, open, isActive } = useListNavigation({
    items: coupons,
    onOpen: (coupon) => onEdit(coupon),
  })
  useRegisterListNav({ next, prev, open })

  if (coupons.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{t.admin.noCoupons}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {t.admin.couponCode}
            </th>
            <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
              {t.admin.couponType}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {t.admin.couponValue}
            </th>
            <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {t.admin.usedCount}
                <HelpTip text={t.tooltips.coupon.used} />
              </span>
            </th>
            <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
              {t.admin.expiresAt}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {t.admin.active}
            </th>
            <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {t.admin.stripeColumn}
                <HelpTip text={t.tooltips.coupon.stripe} />
              </span>
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon, index) => (
            <CouponRow
              key={coupon.id}
              coupon={coupon}
              onEdit={onEdit}
              onDeleted={onDeleted}
              active={isActive(index)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
