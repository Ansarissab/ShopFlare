'use client'

import { useState, useEffect, useRef } from 'react'
import { useCart } from '@/hooks/useCart'

/** Duration must match @keyframes cart-added-pulse in globals.css. */
const PULSE_DURATION_MS = 300

/**
 * Returns `true` for ~300ms after each successful addItem call, driving the
 * cart-icon pulse animation. The CSS keyframe is gated on
 * `prefers-reduced-motion: no-preference`, so applying the class under
 * reduced-motion is safe — the animation simply never runs.
 *
 * A ref snapshots lastAddedAt at mount so a header remount with an already-
 * non-zero value does NOT spuriously pulse — only genuine increases trigger it.
 */
export function useCartPulse(): boolean {
  const lastAddedAt = useCart((s) => s.lastAddedAt)
  const [isPulsing, setIsPulsing] = useState(false)
  // Snapshot the value at mount; only pulse when lastAddedAt strictly increases.
  const snapshotRef = useRef(lastAddedAt)

  useEffect(() => {
    if (lastAddedAt <= snapshotRef.current) return
    snapshotRef.current = lastAddedAt
    setIsPulsing(true)
    const id = setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS)
    return () => clearTimeout(id)
  }, [lastAddedAt])

  return isPulsing
}
