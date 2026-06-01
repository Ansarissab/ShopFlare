import { en } from '@/lib/i18n/en'

export default function AdminReviewsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{en.admin.reviews}</h1>
      <p className="text-sm text-muted-foreground">Review moderation — coming in Phase 3.</p>
    </div>
  )
}
