'use client'

import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { en } from '@/lib/i18n/en'

type Props = {
  orderNumber: string
}

export function OrderPushOptIn({ orderNumber }: Props) {
  const [dismissed, setDismissed] = useState(false)

  const { supported, permission, enabled, enable, loading } = usePushSubscription({
    endpoint: '/api/push/subscribe',
    extraPayload: { orderNumber, kind: 'order' },
  })

  if (!supported || permission === 'denied' || enabled || dismissed) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <Bell className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="font-medium">{en.pwa.orderPushEnableTitle}</p>
          <p className="text-xs text-muted-foreground truncate">{en.pwa.orderPushEnableBody}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => enable()} disabled={loading} className="w-full sm:w-auto">
          {loading ? '…' : en.pwa.orderPushEnableAction}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="w-full sm:w-auto"
        >
          <BellOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
