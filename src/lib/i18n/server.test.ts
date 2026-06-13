import { describe, it, expect, vi, beforeEach } from 'vitest'
import { en } from './en'
import { ur } from './ur'

// ─── mock next/headers ────────────────────────────────────────────────────────
// We need to swap the header value per-test, so we keep a mutable variable.
let localeHeader: string | null = null

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'x-locale' ? localeHeader : null),
  }),
}))

// Import AFTER the mock is registered so the module sees the mock.
const { getLocale, getLocaleHeader, getT } = await import('./server')

// ─── getLocale ────────────────────────────────────────────────────────────────

describe('getLocale', () => {
  beforeEach(() => {
    localeHeader = null
  })

  it('returns "ur" when x-locale header is "ur"', async () => {
    localeHeader = 'ur'
    await expect(getLocale()).resolves.toBe('ur')
  })

  it('returns "fr" when x-locale header is "fr"', async () => {
    localeHeader = 'fr'
    await expect(getLocale()).resolves.toBe('fr')
  })

  it('returns "en" when x-locale header is "en"', async () => {
    localeHeader = 'en'
    await expect(getLocale()).resolves.toBe('en')
  })

  it('defaults to "en" when header is absent (null)', async () => {
    localeHeader = null
    await expect(getLocale()).resolves.toBe('en')
  })

  it('defaults to "en" when header is an unknown locale', async () => {
    localeHeader = 'de'
    await expect(getLocale()).resolves.toBe('en')
  })
})

// ─── getLocaleHeader ─────────────────────────────────────────────────────────

describe('getLocaleHeader', () => {
  beforeEach(() => {
    localeHeader = null
  })

  it('returns the locale when x-locale header is a valid locale', async () => {
    localeHeader = 'fr'
    await expect(getLocaleHeader()).resolves.toBe('fr')
  })

  it('returns null when header is absent', async () => {
    localeHeader = null
    await expect(getLocaleHeader()).resolves.toBeNull()
  })

  it('returns null when header is an unknown locale', async () => {
    localeHeader = 'de'
    await expect(getLocaleHeader()).resolves.toBeNull()
  })
})

// ─── getT ─────────────────────────────────────────────────────────────────────

describe('getT', () => {
  beforeEach(() => {
    localeHeader = null
  })

  it('resolves the ur dictionary when header is "ur"', async () => {
    localeHeader = 'ur'
    await expect(getT()).resolves.toBe(ur)
  })

  it('resolves the en dictionary when header is absent', async () => {
    localeHeader = null
    await expect(getT()).resolves.toBe(en)
  })
})
