import { describe, it, expect } from 'vitest'
import { buildPageMetadata } from './metadata'
import type { LocaleCode } from '@/lib/constants'

describe('buildPageMetadata', () => {
  it('sets title and description', () => {
    const meta = buildPageMetadata({ title: 'Sneakers', description: 'Best sneakers' })
    expect(meta.title).toBe('Sneakers')
    expect(meta.description).toBe('Best sneakers')
  })

  it('sets canonical in alternates', () => {
    const meta = buildPageMetadata({ title: 'T', canonical: 'https://example.com/t' })
    expect(meta.alternates?.canonical).toBe('https://example.com/t')
  })

  it('sets OpenGraph fields', () => {
    const meta = buildPageMetadata({ title: 'T', imageUrl: 'https://img.jpg', storeName: 'Acme' })
    const og = meta.openGraph as Record<string, unknown>
    expect(og.title).toBe('T')
    expect((og.images as Array<{ url: string }>)[0].url).toBe('https://img.jpg')
    expect(og.siteName).toBe('Acme')
  })

  it('sets twitter card to summary_large_image when image provided', () => {
    const meta = buildPageMetadata({ title: 'T', imageUrl: 'https://img.jpg' })
    const tw = meta.twitter as Record<string, unknown>
    expect(tw.card).toBe('summary_large_image')
  })

  it('sets twitter card to summary when no image', () => {
    const meta = buildPageMetadata({ title: 'T' })
    const tw = meta.twitter as Record<string, unknown>
    expect(tw.card).toBe('summary')
  })

  it('omits optional fields when not provided', () => {
    const meta = buildPageMetadata({ title: 'T' })
    expect(meta.description).toBeUndefined()
    expect(meta.alternates?.canonical).toBeUndefined()
  })

  it('includes markdown alternate link when mdUrl provided', () => {
    const meta = buildPageMetadata({ title: 'Test', mdUrl: 'https://example.com/product/abc.md' })
    const types = (meta.alternates as Record<string, unknown>)?.types as
      | Record<string, string>
      | undefined
    expect(types?.['text/markdown']).toBe('https://example.com/product/abc.md')
  })

  it('omits alternates when neither canonical nor mdUrl provided', () => {
    const meta = buildPageMetadata({ title: 'Test' })
    expect(meta.alternates).toBeUndefined()
  })

  it('includes both canonical and mdUrl in alternates', () => {
    const meta = buildPageMetadata({
      title: 'Test',
      canonical: 'https://example.com/product/abc',
      mdUrl: 'https://example.com/product/abc.md',
    })
    expect(meta.alternates?.canonical).toBe('https://example.com/product/abc')
    const types = (meta.alternates as Record<string, unknown>)?.types as
      | Record<string, string>
      | undefined
    expect(types?.['text/markdown']).toBe('https://example.com/product/abc.md')
  })

  it('includes mdUrl without canonical', () => {
    const meta = buildPageMetadata({ title: 'Test', mdUrl: 'https://example.com/p.md' })
    expect(meta.alternates?.canonical).toBeUndefined()
    const types = (meta.alternates as Record<string, unknown>)?.types as
      | Record<string, string>
      | undefined
    expect(types?.['text/markdown']).toBe('https://example.com/p.md')
  })
})

describe('buildPageMetadata — localeAlternates (hreflang)', () => {
  const BASE = 'https://store.example.com'

  it('with localeAlternates set, alternates.languages contains enabled-locale URLs', () => {
    const enabledLocales: LocaleCode[] = ['en', 'fr', 'ur']
    const meta = buildPageMetadata({
      title: 'Product',
      localeAlternates: { path: '/product/abc', enabledLocales, baseUrl: BASE },
    })
    const langs = (meta.alternates as Record<string, unknown>)?.languages as
      | Record<string, string>
      | undefined
    expect(langs).toBeDefined()
    expect(langs!['en']).toBe('https://store.example.com/product/abc')
    expect(langs!['fr']).toBe('https://store.example.com/fr/product/abc')
    expect(langs!['ur']).toBe('https://store.example.com/ur/product/abc')
  })

  it('includes x-default pointing to the default (en) URL', () => {
    const enabledLocales: LocaleCode[] = ['en', 'fr']
    const meta = buildPageMetadata({
      title: 'Product',
      localeAlternates: { path: '/product/abc', enabledLocales, baseUrl: BASE },
    })
    const langs = (meta.alternates as Record<string, unknown>)?.languages as Record<string, string>
    expect(langs['x-default']).toBe('https://store.example.com/product/abc')
  })

  it('without localeAlternates, alternates.languages is absent', () => {
    const meta = buildPageMetadata({ title: 'Test', canonical: 'https://store.example.com/test' })
    const langs = (meta.alternates as Record<string, unknown>)?.languages
    expect(langs).toBeUndefined()
  })

  it('without any alternates input, alternates is undefined', () => {
    const meta = buildPageMetadata({ title: 'Test' })
    expect(meta.alternates).toBeUndefined()
  })

  it('combines canonical + localeAlternates in same alternates object', () => {
    const enabledLocales: LocaleCode[] = ['en', 'fr']
    const meta = buildPageMetadata({
      title: 'Test',
      canonical: `${BASE}/product/abc`,
      localeAlternates: { path: '/product/abc', enabledLocales, baseUrl: BASE },
    })
    expect(meta.alternates?.canonical).toBe(`${BASE}/product/abc`)
    const langs = (meta.alternates as Record<string, unknown>)?.languages as Record<string, string>
    expect(langs['en']).toBe(`${BASE}/product/abc`)
    expect(langs['fr']).toBe(`${BASE}/fr/product/abc`)
  })

  it('only enabled locales appear (not all SHIPPED_LOCALES)', () => {
    const enabledLocales: LocaleCode[] = ['en']
    const meta = buildPageMetadata({
      title: 'Test',
      localeAlternates: { path: '/shop', enabledLocales, baseUrl: BASE },
    })
    const langs = (meta.alternates as Record<string, unknown>)?.languages as Record<string, string>
    expect(langs['fr']).toBeUndefined()
    expect(langs['ur']).toBeUndefined()
    expect(langs['en']).toBeDefined()
    expect(langs['x-default']).toBeDefined()
  })
})
