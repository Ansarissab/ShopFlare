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
})
