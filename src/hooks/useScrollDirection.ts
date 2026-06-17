'use client'
import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 80 // px — must scroll past this before hide kicks in
const DELTA = 5 // px — ignore jitters smaller than this

/**
 * Tracks scroll direction.
 * Returns `hidden: true` when the user has scrolled DOWN past THRESHOLD.
 * Resets to `hidden: false` immediately on any upward movement or when
 * scrollY drops back to/below THRESHOLD.
 * rAF-throttled; SSR-safe; cleans up on unmount.
 */
export function useScrollDirection(): { hidden: boolean } {
  const [hidden, setHidden] = useState(false)
  const lastScrollY = useRef(0)
  const rafId = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialise from real scroll position (e.g. page restored mid-scroll)
    lastScrollY.current = window.scrollY

    const onScroll = () => {
      if (rafId.current !== null) return // already queued
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null
        const y = window.scrollY
        const diff = y - lastScrollY.current

        if (Math.abs(diff) < DELTA) return // ignore micro-jitter

        if (y <= THRESHOLD) {
          setHidden(false) // near top → always show
        } else if (diff > 0) {
          setHidden(true) // scrolling DOWN → hide
        } else {
          setHidden(false) // scrolling UP → reveal
        }

        lastScrollY.current = y
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return { hidden }
}
