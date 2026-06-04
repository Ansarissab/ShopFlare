'use client'

// Web Push subscription hook — Agent O.
//
// Checks browser support, requests permission, uses navigator.serviceWorker.ready
// (registration is managed by ServiceWorkerProvider in the root layout),
// subscribes via PushManager, and POSTs the subscription to the given endpoint.
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
import type { PublicConfigResponse, UsePushSubscriptionReturn } from '@/lib/types/common'

export type PushSubscriptionOptions = {
  /** POST endpoint for the subscription. Defaults to '/api/admin/push/subscribe' */
  endpoint?: string
  /** Additional fields merged into the POST body (e.g. { orderNumber, kind: 'order' }) */
  extraPayload?: Record<string, unknown>
}

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

export function usePushSubscription(opts: PushSubscriptionOptions = {}): UsePushSubscriptionReturn {
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

      // Check per-endpoint registration in localStorage first (avoids cross-endpoint
      // false-positives where an admin sub would suppress the customer opt-in).
      const storageKey = `pwa-push-${opts.endpoint ?? 'admin'}`
      const wasRegistered = (() => { try { return localStorage.getItem(storageKey) === '1' } catch { return false } })()
      if (wasRegistered) {
        setEnabled(true)
        return
      }

      // Fallback: check PushManager (covers cases where localStorage was cleared)
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
  }, [opts.endpoint])

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

      // 3. Use the already-registered SW (ServiceWorkerProvider handles registration)
      const swTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SW not ready — registration may have failed')), 10_000),
      )
      const reg = await Promise.race([navigator.serviceWorker.ready, swTimeout])

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

      // 6. POST to the configured endpoint (default: admin subscribe)
      //    api.ts sends CF Access cookie for /api/admin paths automatically.
      await apiPost(opts.endpoint ?? '/api/admin/push/subscribe', {
        endpoint: sub.endpoint,
        auth,
        p256dh,
        ...opts.extraPayload,
      })

      setEnabled(true)
      try { localStorage.setItem(`pwa-push-${opts.endpoint ?? 'admin'}`, '1') } catch {}
      return true
    } catch (err) {
      console.warn('[usePushSubscription] enable error', err)
      return false
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, loading, opts.endpoint, JSON.stringify(opts.extraPayload)])

  return { supported, permission, enabled, enable, loading }
}
