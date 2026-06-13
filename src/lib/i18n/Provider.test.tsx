// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, renderHook } from '@testing-library/react'
import React from 'react'
import { en } from './en'
import { fr } from './fr'
import { TProvider, useT, useLocale } from './Provider'

afterEach(cleanup)

// ─── TProvider + useT ────────────────────────────────────────────────────────

describe('TProvider', () => {
  it('provides the fr dictionary inside <TProvider locale="fr">', () => {
    let captured: unknown
    function Probe() {
      captured = useT()
      return null
    }
    render(
      <TProvider locale="fr">
        <Probe />
      </TProvider>,
    )
    expect(captured).toBe(fr)
  })

  it('provides the en dictionary inside <TProvider locale="en">', () => {
    let captured: unknown
    function Probe() {
      captured = useT()
      return null
    }
    render(
      <TProvider locale="en">
        <Probe />
      </TProvider>,
    )
    expect(captured).toBe(en)
  })
})

// ─── useT fallback (no provider) ─────────────────────────────────────────────

describe('useT fallback — no provider mounted', () => {
  it('returns the en dictionary when no TProvider is present', () => {
    const { result } = renderHook(() => useT())
    expect(result.current).toBe(en)
  })
})

// ─── useLocale ────────────────────────────────────────────────────────────────

describe('useLocale', () => {
  it('returns the locale provided by TProvider', () => {
    const { result } = renderHook(() => useLocale(), {
      wrapper: ({ children }) => <TProvider locale="ur">{children}</TProvider>,
    })
    expect(result.current).toBe('ur')
  })

  it('returns "en" when no TProvider is present', () => {
    const { result } = renderHook(() => useLocale())
    expect(result.current).toBe('en')
  })
})
