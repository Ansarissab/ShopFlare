'use client'

// EnablePushButton — Agent O.
//
// Small button that lets the merchant (admin) enable Web Push notifications
// for new orders. Uses the usePushSubscription hook and surfaces copy from
// en.notifications.
//
// Usage: import and render anywhere in the admin layout/settings.
// Example: <EnablePushButton /> in AdminSidebar or the Settings page footer.

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { en } from '@/lib/i18n/en'

export function EnablePushButton() {
  const { supported, permission, enabled, enable, loading } = usePushSubscription()

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">{en.notifications.pushUnsupported}</p>
    )
  }

  if (permission === 'denied') {
    return (
      <p className="text-xs text-muted-foreground">{en.notifications.pushBlocked}</p>
    )
  }

  if (enabled) {
    return (
      <p className="text-xs text-muted-foreground">{en.notifications.pushEnabled}</p>
    )
  }

  async function handleClick() {
    const ok = await enable()
    if (ok) {
      toast.success(en.notifications.pushEnabled)
    } else {
      toast.error(en.notifications.pushBlocked)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? '…' : en.notifications.enablePush}
    </Button>
  )
}
