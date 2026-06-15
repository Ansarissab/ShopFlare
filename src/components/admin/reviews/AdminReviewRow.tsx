'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewStars } from '@/components/store/product/ReviewStars'
import { apiPatch, apiDelete } from '@/lib/api'
import { formatDate } from '@/lib/utils/index'
import { useT } from '@/lib/i18n/Provider'
import { cn } from '@/lib/utils'
import { layout } from '@/lib/styles'
import type { AdminReviewRowProps } from '@/lib/types/admin'

export function AdminReviewRow({ review, onChanged, active }: AdminReviewRowProps) {
  const t = useT()
  const [busy, setBusy] = useState(false)

  async function handleApprove() {
    setBusy(true)
    try {
      await apiPatch(`/api/admin/reviews/${review.id}`, { approved: true })
      toast.success(t.admin.reviewApproved)
      onChanged()
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    setBusy(true)
    try {
      await apiPatch(`/api/admin/reviews/${review.id}`, { approved: false })
      toast.success(t.admin.reviewRejected)
      onChanged()
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(t.admin.deleteReviewConfirm)) return
    setBusy(true)
    try {
      await apiDelete(`/api/admin/reviews/${review.id}`)
      toast.success(t.admin.reviewDeleted)
      onChanged()
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr
      className={cn(
        'border-b last:border-0 hover:bg-muted/30 transition-colors align-top',
        active && layout.activeRow,
      )}
    >
      <td className="px-4 py-3">
        <Badge variant={review.approved ? 'default' : 'secondary'}>
          {review.approved ? t.admin.approvedReviews : t.admin.pendingReviews}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm font-medium">{review.productName}</td>
      <td className="hidden md:table-cell px-4 py-3 text-sm">{review.customerName}</td>
      <td className="px-4 py-3">
        <ReviewStars rating={review.rating} />
      </td>
      <td className="hidden sm:table-cell px-4 py-3 max-w-[60vw] sm:max-w-xs">
        {review.body ? (
          <p className="text-sm text-muted-foreground line-clamp-2">{review.body}</p>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="hidden md:table-cell px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(review.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {!review.approved ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={busy}
              onClick={handleApprove}
            >
              {t.admin.approveReview}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={busy}
              onClick={handleReject}
            >
              {t.admin.rejectReview}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={handleDelete}
            aria-label={t.admin.deleteReview}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </td>
    </tr>
  )
}
