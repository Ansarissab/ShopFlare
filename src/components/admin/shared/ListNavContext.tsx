'use client'

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type { ListNavController } from '@/lib/types/shortcuts'

// The context holds a MutableRefObject so that:
// - AdminShortcuts can call ref.current?.next() at any time without stale closures.
// - Tables can write their controller into ref.current on every render (trivially
//   cheap) without causing re-renders or identity-change problems.

const ListNavContext = createContext<MutableRefObject<ListNavController | null> | null>(null)

export function ListNavProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<ListNavController | null>(null)
  return <ListNavContext.Provider value={controllerRef}>{children}</ListNavContext.Provider>
}

/**
 * Call in a list table component body. Writes the current controller into the
 * shared ref on every render (O(1), no effect overhead). Clears on unmount.
 */
export function useRegisterListNav(controller: ListNavController): void {
  const ref = useContext(ListNavContext)
  // Write synchronously so the ref is always fresh (avoids stale-closure issue).
  if (ref) ref.current = controller

  useEffect(() => {
    return () => {
      if (ref) ref.current = null
    }
    // ref identity is stable for the lifetime of the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}

/**
 * Call in AdminShortcuts to get the shared ref. Use `ref.current?.next()` etc.
 */
export function useListNavRef(): MutableRefObject<ListNavController | null> | null {
  return useContext(ListNavContext)
}
