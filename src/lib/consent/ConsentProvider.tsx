'use client'

import * as React from 'react'
import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from '@/lib/constants'
import type { ConsentValue } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConsentState {
  /** Null until read from cookie (SSR-safe default). */
  consented: ConsentValue
  /** True once the cookie has been read on the client — prevents flash. */
  ready: boolean
  /** Accept all non-essential cookies. Persists choice as a 1-year cookie. */
  accept(): void
  /** Decline all non-essential cookies. Persists choice as a 1-year cookie. */
  decline(): void
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

/** Encoded cookie value format: `<version>:accepted` | `<version>:declined` */
function encodeCookieValue(accepted: boolean): string {
  return `${CONSENT_VERSION}:${accepted ? 'accepted' : 'declined'}`
}

/** Read and decode the consent cookie. Returns null if absent or version mismatch. */
function readConsentCookie(): boolean | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`))
  if (!match) return null
  const raw = match.slice(CONSENT_COOKIE_NAME.length + 1)
  const [version, choice] = raw.split(':')
  if (Number(version) !== CONSENT_VERSION) return null
  return choice === 'accepted'
}

/** Write the consent cookie (1-year, SameSite=Lax, path=/, Secure on HTTPS). */
function writeConsentCookie(accepted: boolean): void {
  if (typeof document === 'undefined') return
  const value = encodeCookieValue(accepted)
  const maxAge = 365 * 24 * 60 * 60 // 1 year in seconds
  // Append Secure only when served over HTTPS — keeps local http dev working.
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; Max-Age=${maxAge}; SameSite=Lax; path=/${secure}`
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ConsentContext = React.createContext<ConsentState>({
  consented: null,
  ready: false,
  accept: () => {},
  decline: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consented, setConsented] = React.useState<ConsentValue>(null)
  const [ready, setReady] = React.useState(false)

  // Read cookie on mount (client-only — avoids SSR mismatch).
  React.useEffect(() => {
    setConsented(readConsentCookie())
    setReady(true)
  }, [])

  const accept = React.useCallback(() => {
    writeConsentCookie(true)
    setConsented(true)
  }, [])

  const decline = React.useCallback(() => {
    writeConsentCookie(false)
    setConsented(false)
  }, [])

  return (
    <ConsentContext.Provider value={{ consented, ready, accept, decline }}>
      {children}
    </ConsentContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the visitor's cookie-consent state.
 *
 * ```ts
 * const { consented, ready, accept, decline } = useConsent()
 * ```
 *
 * Gate marketing scripts on `consented === true` (not just truthy) — null means
 * "not yet decided / SSR" and must be treated as declined.
 */
export function useConsent(): ConsentState {
  return React.useContext(ConsentContext)
}
