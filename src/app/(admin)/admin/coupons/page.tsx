import { en } from '@/lib/i18n/en'

export default function AdminCouponsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{en.admin.coupons}</h1>
      <p className="text-sm text-muted-foreground">Coupon management — coming in Phase 3.</p>
    </div>
  )
}
