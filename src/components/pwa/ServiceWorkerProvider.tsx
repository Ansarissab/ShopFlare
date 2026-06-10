'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { en } from '@/lib/i18n/en'

type SWContext = {
  registration: ServiceWorkerRegistration | null
  updateAvailable: boolean
}

const SWCtx = createContext<SWContext>({ registration: null, updateAvailable: false })

export function useServiceWorker() {
  return useContext(SWCtx)
}

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const reloadingRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    function handleWaiting(sw: ServiceWorker) {
      setUpdateAvailable(true)
      toast(en.pwa.updateAvailable, {
        duration: Infinity,
        action: {
          label: en.pwa.updateReload,
          onClick: () => {
            sw.postMessage({ type: 'SKIP_WAITING' })
          },
        },
      })
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((r) => {
        setRegistration(r)

        if (r.waiting) handleWaiting(r.waiting)

        r.addEventListener('updatefound', () => {
          const newSW = r.installing
          if (!newSW) return
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              handleWaiting(newSW)
            }
          })
        })
      })
      .catch(() => {
        /* SW unavailable — ignore */
      })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingRef.current) return
      reloadingRef.current = true
      window.location.reload()
    })

    return () => {
      /* cleanup not needed — SW lifecycle survives component unmount */
    }
  }, [])

  return <SWCtx.Provider value={{ registration, updateAvailable }}>{children}</SWCtx.Provider>
}
