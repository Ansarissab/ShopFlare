'use client'

// ─── Scroll-reveal entrance hook ──────────────────────────────────────────────
// Attaches an IntersectionObserver to the returned ref. When the element enters
// the viewport, adds CSS classes that trigger a fade+lift-in transition defined
// in globals.css (.reveal-init / .reveal-in).
//
// SSR / no-JS safety: element is FULLY VISIBLE by default. The hidden state
// (.reveal-init) is only applied AFTER mount AND only when the user has not
// opted into reduced-motion. Server HTML never sees .reveal-init.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export interface UseRevealOptions {
  /** Unobserve after first intersection (default: true). */
  once?: boolean
  /** Fraction of element that must be visible to trigger (default: 0.15). */
  threshold?: number
  /**
   * Expand the detection area above the viewport so the reveal fires slightly
   * before the element is fully in view (default: '0px 0px -40px 0px').
   */
  rootMargin?: string
}

export function useReveal<T extends HTMLElement = HTMLElement>(
  options: UseRevealOptions = {},
): RefObject<T | null> {
  const { once = true, threshold = 0.15, rootMargin = '0px 0px -40px 0px' } = options
  const ref = useRef<T | null>(null)

  useEffect(() => {
    // Bail out if matchMedia or IntersectionObserver unavailable (e.g. old browsers, jsdom).
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      typeof IntersectionObserver === 'undefined'
    )
      return

    // Bail out if user prefers reduced motion — element stays fully visible.
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return

    const el = ref.current
    if (!el) return

    // Apply hidden-then-reveal state only now (post-mount, motion allowed).
    el.classList.add('reveal-init')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.remove('reveal-init')
            el.classList.add('reveal-in')
            if (once) observer.unobserve(el)
            break
          }
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      // On unmount, restore visibility so a remounted component isn't stuck hidden.
      // Remove both classes so a reused DOM node re-animates on next mount.
      el.classList.remove('reveal-init')
      el.classList.remove('reveal-in')
    }
  }, [once, threshold, rootMargin])

  return ref
}
