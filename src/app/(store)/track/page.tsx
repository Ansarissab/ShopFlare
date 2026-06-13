'use client'

import { TrackingForm } from '@/components/store/tracking/TrackingForm'
import { useT } from '@/lib/i18n/Provider'

export default function TrackPage() {
  const t = useT()
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.tracking.title}</h1>
        <p className="text-sm text-muted-foreground">
          Enter your order number and email or phone to see your order status.
        </p>
      </div>

      <div className="w-full rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <TrackingForm />
      </div>
    </div>
  )
}
