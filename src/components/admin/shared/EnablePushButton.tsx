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
import { useT } from '@/lib/i18n/Provider'

export function EnablePushButton() {
  const t = useT()
  const { supported, permission, enabled, enable, loading } = usePushSubscription()

  if (!supported) {
    return <p className="text-xs text-muted-foreground">{t.notifications.pushUnsupported}</p>
  }

  if (permission === 'denied') {
    return <p className="text-xs text-muted-foreground">{t.notifications.pushBlocked}</p>
  }

  if (enabled) {
    return <p className="text-xs text-muted-foreground">{t.notifications.pushEnabled}</p>
  }

  async function handleClick() {
    const ok = await enable()
    if (ok) {
      toast.success(t.notifications.pushEnabled)
    } else {
      toast.error(t.notifications.pushBlocked)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={loading}>
      {loading ? t.notifications.enabling : t.notifications.enablePush}
    </Button>
  )
}
