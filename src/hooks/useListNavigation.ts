import { useState, useCallback } from 'react'

export interface UseListNavigationOptions<T> {
  items: readonly T[]
  onOpen?: (item: T, index: number) => void
}

export interface UseListNavigationResult {
  activeIndex: number
  setActiveIndex: (i: number) => void
  next(): void
  prev(): void
  open(): void
  isActive(index: number): boolean
}

/**
 * Manages keyboard-driven row selection for list tables.
 * SSR-safe — no direct window/document access.
 */
export function useListNavigation<T>({
  items,
  onOpen,
}: UseListNavigationOptions<T>): UseListNavigationResult {
  const [activeIndex, setActiveIndex] = useState(-1)

  const next = useCallback(() => {
    if (items.length === 0) return
    setActiveIndex((prev) => {
      if (prev === -1) return 0
      return Math.min(prev + 1, items.length - 1)
    })
  }, [items.length])

  const prev = useCallback(() => {
    if (items.length === 0) return
    setActiveIndex((prev) => {
      if (prev <= 0) return 0
      return prev - 1
    })
  }, [items.length])

  const open = useCallback(() => {
    setActiveIndex((current) => {
      if (current >= 0 && current < items.length) {
        onOpen?.(items[current], current)
      }
      return current
    })
  }, [items, onOpen])

  const isActive = useCallback((index: number) => activeIndex === index, [activeIndex])

  return { activeIndex, setActiveIndex, next, prev, open, isActive }
}
