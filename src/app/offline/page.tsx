'use client'
import { en } from '@/lib/i18n/en'
import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <WifiOff className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">{en.pwa.offlineTitle}</h1>
      <p className="text-muted-foreground">{en.pwa.offlineBody}</p>
      <Button onClick={() => window.location.reload()}>{en.pwa.offlineRetry}</Button>
    </div>
  )
}
