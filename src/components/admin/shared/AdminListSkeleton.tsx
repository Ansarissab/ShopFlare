// Shared loading skeleton for admin list pages: a vertical stack of uniform rows.
// Props are declared in lib/types/admin to satisfy DRY rule 3 (no inline Props types).
import { Skeleton } from '@/components/ui/skeleton'
import type { AdminListSkeletonProps } from '@/lib/types/admin'

export function AdminListSkeleton({
  rows,
  itemClassName = 'h-12 w-full rounded-md',
}: AdminListSkeletonProps) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={itemClassName} />
      ))}
    </div>
  )
}
