import { describe, it, expect } from 'vitest'
import { en } from './en'
import { fr } from './fr'
import { ur } from './ur'
import { getDictionary, isLocale } from './index'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Collect every leaf key path in a nested object (no arrays in the dict). */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') {
      return collectKeys(v as Record<string, unknown>, path)
    }
    return [path]
  })
}

// ─── isLocale ────────────────────────────────────────────────────────────────

describe('isLocale', () => {
  it('returns true for shipped locales', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('fr')).toBe(true)
    expect(isLocale('ur')).toBe(true)
  })

  it('returns false for unknown/null/empty', () => {
    expect(isLocale('de')).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(undefined)).toBe(false)
    expect(isLocale('')).toBe(false)
    expect(isLocale('EN')).toBe(false) // case-sensitive
  })
})

// ─── getDictionary ───────────────────────────────────────────────────────────

describe('getDictionary', () => {
  it('returns en dict for "en"', () => {
    expect(getDictionary('en')).toBe(en)
  })

  it('returns fr dict for "fr"', () => {
    expect(getDictionary('fr')).toBe(fr)
  })

  it('returns ur dict for "ur"', () => {
    expect(getDictionary('ur')).toBe(ur)
  })

  it('falls back to en for unknown locale', () => {
    expect(getDictionary('de')).toBe(en)
    expect(getDictionary('zh')).toBe(en)
  })

  it('falls back to en for null', () => {
    expect(getDictionary(null)).toBe(en)
  })

  it('falls back to en for empty string', () => {
    expect(getDictionary('')).toBe(en)
  })

  it('falls back to en for undefined', () => {
    expect(getDictionary(undefined)).toBe(en)
  })
})

// ─── Drift guard — structural completeness ───────────────────────────────────

describe('dictionary structural drift guard', () => {
  const enKeys = collectKeys(en as unknown as Record<string, unknown>).sort()

  it('fr has identical top-level keys as en', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort())
  })

  it('ur has identical top-level keys as en', () => {
    expect(Object.keys(ur).sort()).toEqual(Object.keys(en).sort())
  })

  it('fr has identical deep keys as en', () => {
    const frKeys = collectKeys(fr as unknown as Record<string, unknown>).sort()
    expect(frKeys).toEqual(enKeys)
  })

  it('ur has identical deep keys as en', () => {
    const urKeys = collectKeys(ur as unknown as Record<string, unknown>).sort()
    expect(urKeys).toEqual(enKeys)
  })
})
