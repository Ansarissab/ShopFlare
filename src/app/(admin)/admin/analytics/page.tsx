import { en } from '@/lib/i18n/en'

export default function AdminAnalyticsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{en.admin.analytics}</h1>
      <p className="text-sm text-muted-foreground">Analytics dashboard — coming in Phase 3.</p>
    </div>
  )
}
