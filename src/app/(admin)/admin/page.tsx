'use client'

import Link from 'next/link'
import { Package, ShoppingCart, Clock, AlertTriangle } from 'lucide-react'
import { StatCard } from '@/components/admin/shared/StatCard'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { useApiResource } from '@/hooks/useApiResource'
import type { AdminOrdersResponse } from '@/lib/types/store'

interface DashboardStats {
  total: number
  pending: number
  revenueCents: number
  lowStock: number
}

function computeStats(data: AdminOrdersResponse | null): DashboardStats {
  if (!data) return { total: 0, pending: 0, revenueCents: 0, lowStock: 0 }
  const pending = data.orders.filter((o) => o.status === 'pending').length
  const revenueCents = data.orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.totalCents, 0)
  return { total: data.total, pending, revenueCents, lowStock: 0 }
}

export default function AdminDashboardPage() {
  const { data, loading } = useApiResource<AdminOrdersResponse>('/api/admin/orders?limit=100')
  const stats = computeStats(data)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{en.admin.dashboard}</h1>
        <div className="flex gap-2">
          <Link href="/admin/products/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            {en.admin.addProduct}
          </Link>
          <Link href="/admin/pos" className={cn(buttonVariants({ size: 'sm' }))}>
            {en.admin.pos}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label={en.admin.totalOrders}
            value={stats.total}
            sub="all time"
          />
          <StatCard
            label={en.admin.totalRevenue}
            value={formatPrice(stats.revenueCents)}
          />
          <StatCard
            label={en.admin.pendingOrders}
            value={stats.pending}
          />
          <StatCard
            label={en.admin.lowStockAlert}
            value={stats.lowStock}
            sub="variants below threshold"
          />
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { href: '/admin/orders',   icon: ShoppingCart, label: en.admin.orders },
          { href: '/admin/products', icon: Package,      label: en.admin.products },
          { href: '/admin/pos',      icon: Clock,        label: en.admin.pos },
          { href: '/admin/settings', icon: AlertTriangle, label: en.admin.settings },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-xl border bg-card p-5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Icon className="size-6 text-muted-foreground" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
