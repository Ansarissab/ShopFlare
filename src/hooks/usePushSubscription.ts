'use client'

// Web Push subscription hook — Agent O.
//
// Checks browser support, requests permission, registers the service worker,
// subscribes via PushManager, and POSTs the subscription to /api/push/subscribe.
// The VAPID public key is fetched from GET /api/public-config (already cached
// there by the worker). All copy comes from en.notifications.
//
// Returns:
//   supported   — browser supports push notifications
//   permission  — NotificationPermission ('default'|'granted'|'denied')
//   enabled     — subscription currently active
//   enable()    — async: request permission + subscribe
//   loading     — async operation in flight

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import type { PublicConfigResponse, UsePushSubscriptionReturn } from '@/lib/types/store'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Defer capability detection off the synchronous effect body: this keeps
    // SSR markup stable (no hydration mismatch) and avoids setState-in-effect.
    Promise.resolve().then(() => {
      if (cancelled) return

      const isSupported =
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window

      setSupported(isSupported)
      if (!isSupported) return

      setPermission(Notification.permission)

      // Check if already subscribed
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (!cancelled && sub) setEnabled(true)
        })
        .catch(() => {/* no-op */})
    })

    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported || loading) return false
    setLoading(true)

    try {
      // 1. Request notification permission
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return false

      // 2. Fetch VAPID public key
      const config = await apiGet<PublicConfigResponse>('/api/public-config')
      if (!config.vapidPublicKey) return false

      // 3. Register service worker (idempotent — no-op if already registered)
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // 4. Subscribe via PushManager
      const applicationServerKey = urlBase64ToUint8Array(config.vapidPublicKey)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      // 5. Extract keys from the subscription
      const rawSub = sub.toJSON()
      const auth = rawSub.keys?.auth
      const p256dh = rawSub.keys?.p256dh

      if (!auth || !p256dh) throw new Error('Missing push subscription keys')

      // 6. POST to worker (admin-gated — api.ts sends the CF Access cookie for
      //    /api/admin paths)
      await apiPost('/api/admin/push/subscribe', {
        endpoint: sub.endpoint,
        auth,
        p256dh,
      })

      setEnabled(true)
      return true
    } catch (err) {
      console.warn('[usePushSubscription] enable error', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [supported, loading])

  return { supported, permission, enabled, enable, loading }
}
