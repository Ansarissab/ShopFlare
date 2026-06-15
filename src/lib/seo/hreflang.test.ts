import { describe, it, expect } from 'vitest'
import { buildLocaleAlternates } from './hreflang'

const BASE = 'https://example.com'

describe('buildLocaleAlternates', () => {
  it('default locale (en) gets no prefix', () => {
    const { languages } = buildLocaleAlternates('/product/abc', ['en'], BASE)
    expect(languages['en']).toBe('https://example.com/product/abc')
  })

  it('fr gets /fr prefix', () => {
    const { languages } = buildLocaleAlternates('/product/abc', ['en', 'fr'], BASE)
    expect(languages['fr']).toBe('https://example.com/fr/product/abc')
  })

  it('ur gets /ur prefix', () => {
    const { languages } = buildLocaleAlternates('/product/abc', ['en', 'ur'], BASE)
    expect(languages['ur']).toBe('https://example.com/ur/product/abc')
  })

  it('x-default equals the default-locale URL', () => {
    const { languages, xDefault } = buildLocaleAlternates('/product/abc', ['en', 'fr', 'ur'], BASE)
    expect(xDefault).toBe('https://example.com/product/abc')
    expect(languages['x-default']).toBe('https://example.com/product/abc')
  })

  it('only enabled locales appear in languages (excluding x-default)', () => {
    const { languages } = buildLocaleAlternates('/shop', ['en', 'fr'], BASE)
    const localeKeys = Object.keys(languages).filter((k) => k !== 'x-default')
    expect(localeKeys).toEqual(['en', 'fr'])
    expect(languages['ur']).toBeUndefined()
  })

  it('all three locales enabled — correct URLs for all', () => {
    const { languages } = buildLocaleAlternates('/product/x', ['en', 'fr', 'ur'], BASE)
    expect(languages['en']).toBe('https://example.com/product/x')
    expect(languages['fr']).toBe('https://example.com/fr/product/x')
    expect(languages['ur']).toBe('https://example.com/ur/product/x')
    expect(languages['x-default']).toBe('https://example.com/product/x')
  })

  it('root path "/" — default keeps "/", prefixed locale has no trailing slash', () => {
    const { languages, xDefault } = buildLocaleAlternates('/', ['en', 'fr'], BASE)
    // Default locale root matches the home canonical (`${base}/`).
    expect(languages['en']).toBe('https://example.com/')
    // Prefixed-locale root drops the trailing slash (Next serves `/fr`, not `/fr/`).
    expect(languages['fr']).toBe('https://example.com/fr')
    expect(xDefault).toBe('https://example.com/')
    // No accidental double slash in the path portion.
    expect(languages['en']).not.toMatch(/\/\/(?!example)/)
    expect(languages['fr']).not.toMatch(/\/\/(?!example)/)
  })

  it('path without leading slash is normalized', () => {
    const { languages } = buildLocaleAlternates('product/abc', ['en', 'fr'], BASE)
    expect(languages['en']).toBe('https://example.com/product/abc')
    expect(languages['fr']).toBe('https://example.com/fr/product/abc')
  })

  it('single locale (en only) — x-default and en both present', () => {
    const { languages } = buildLocaleAlternates('/faq', ['en'], BASE)
    expect(Object.keys(languages)).toEqual(['en', 'x-default'])
    expect(languages['en']).toBe('https://example.com/faq')
    expect(languages['x-default']).toBe('https://example.com/faq')
  })
})
