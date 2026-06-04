'use client'

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { CouponsTable } from '@/components/admin/coupons/CouponsTable'
import { CouponForm } from '@/components/admin/coupons/CouponForm'
import { en } from '@/lib/i18n/en'
import { useApiResource } from '@/hooks/useApiResource'
import type { CouponsResponse, AdminCoupon } from '@/lib/types/admin'

export default function AdminCouponsPage() {
  const [formKey, setFormKey] = useState(0)
  const [resourcePath, setResourcePath] = useState('/api/admin/coupons')
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | undefined>(undefined)

  // Bump path key to re-trigger the resource fetch
  const refetch = useCallback(() => {
    setResourcePath(`/api/admin/coupons?_t=${Date.now()}`)
  }, [])

  const { data, loading } = useApiResource<CouponsResponse>(resourcePath)

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
        title={en.admin.coupons}
        actions={!showForm ? (
          <Button size="sm" onClick={handleAdd}>
            <Plus className="size-3.5 mr-1" aria-hidden />
            {en.admin.addCoupon}
          </Button>
        ) : undefined}
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
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <CouponsTable
          coupons={data?.coupons ?? []}
          onEdit={handleEdit}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
