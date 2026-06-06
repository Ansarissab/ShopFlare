'use client'

// One-shot viewport prefetch. Attaches an IntersectionObserver to the returned
// ref; when the element scrolls near the viewport it primes the HTTP cache for
// `path` once, then disconnects. Complements hover/focus intent prefetch.

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { prefetch } from '@/lib/api'

export function useViewportPrefetch<T extends HTMLElement = HTMLElement>(
  path: string,
): RefObject<T | null> {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            prefetch(path)
            observer.disconnect()
            break
          }
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [path])

  return ref
}
