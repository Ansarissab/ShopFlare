import { describe, it, expect } from 'vitest'
import { buildPageMetadata } from './metadata'

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
