'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminListSkeleton } from '@/components/admin/shared/AdminListSkeleton'
import { CouponsTable } from '@/components/admin/coupons/CouponsTable'
import { CouponForm } from '@/components/admin/coupons/CouponForm'
import { useT } from '@/lib/i18n/Provider'
import { useApiResource } from '@/hooks/useApiResource'
import type { CouponsResponse, AdminCoupon } from '@/lib/types/admin'

export default function AdminCouponsPage() {
  const t = useT()
  const [formKey, setFormKey] = useState(0)
  const [resourcePath, setResourcePath] = useState('/api/admin/coupons')
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState('all')

  // Bump path key to re-trigger the resource fetch
  const refetch = useCallback(() => {
    setResourcePath(`/api/admin/coupons?_t=${Date.now()}`)
  }, [])

  const { data, loading } = useApiResource<CouponsResponse>(resourcePath)

  const filteredCoupons = useMemo(() => {
    const all = data?.coupons ?? []
    if (statusFilter === 'all') return all
    const now = new Date()
    return all.filter((c) => {
      const isExpired = c.expiresAt != null && new Date(c.expiresAt) < now
      if (statusFilter === 'expired') return isExpired
      if (statusFilter === 'inactive') return !c.active && !isExpired
      // active: active flag true AND not expired
      return c.active && !isExpired
    })
  }, [data, statusFilter])

  function handleAdd() {
    setEditingCoupon(undefined)
    setFormKey((k) => k + 1)
    setShowForm(true)
  }

  function handleEdit(coupon: AdminCoupon) {
    setEditingCoupon(coupon)
    setFormKey((k) => k + 1)
    setShowForm(true)
  }

  function handleSaved() {
    setShowForm(false)
    setEditingCoupon(undefined)
    refetch()
  }

  function handleCancel() {
    setShowForm(false)
    setEditingCoupon(undefined)
  }

  function handleDeleted() {
    refetch()
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.admin.coupons}
        actions={
          !showForm ? (
            <>
              <Select
                value={statusFilter}
                onValueChange={(v: string | null) => setStatusFilter(v ?? 'all')}
              >
                <SelectTrigger className="w-40" aria-label={t.admin.couponFilterLabel}>
                  <SelectValue placeholder={t.admin.couponFilterAll} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.admin.couponFilterAll}</SelectItem>
                  <SelectItem value="active">{t.admin.couponFilterActive}</SelectItem>
                  <SelectItem value="inactive">{t.admin.couponFilterInactive}</SelectItem>
                  <SelectItem value="expired">{t.admin.couponFilterExpired}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="size-3.5 mr-1" aria-hidden />
                {t.admin.addCoupon}
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Inline create/edit form */}
      {showForm && (
        <div className="rounded-lg border p-5">
          <CouponForm
            key={formKey}
            coupon={editingCoupon}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </div>
      )}

      {showForm && <Separator />}

      {/* Table */}
      {loading ? (
        <AdminListSkeleton rows={4} />
      ) : (
        <CouponsTable coupons={filteredCoupons} onEdit={handleEdit} onDeleted={handleDeleted} />
      )}
    </div>
  )
}
