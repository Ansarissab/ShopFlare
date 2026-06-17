import { describe, it, expect } from 'vitest'
import { catalogHref, buildCategoryHref, buildPrimaryNavLinks } from '@/lib/nav'
import type { StoreConfig } from '@/lib/types/common'

// ─── buildCategoryHref ────────────────────────────────────────────────────────
// Regression: "Browse accessories" (and any category CTA) must resolve to
// /category/<slug>, NOT /shop/<slug>. /shop/[slug] has no route; clicking it 404s.

describe('buildCategoryHref', () => {
  it('resolves accessories slug to /category/accessories', () => {
    expect(buildCategoryHref('accessories')).toBe('/category/accessories')
  })

  it('resolves apparel slug to /category/apparel', () => {
    expect(buildCategoryHref('apparel')).toBe('/category/apparel')
  })

  it('does NOT produce a /shop/<slug> URL (which has no route)', () => {
    expect(buildCategoryHref('accessories')).not.toMatch(/^\/shop\//)
  })

  it('works for arbitrary slug values', () => {
    expect(buildCategoryHref('new-arrivals')).toBe('/category/new-arrivals')
  })

  it('percent-encodes slugs with spaces or non-ASCII characters', () => {
    expect(buildCategoryHref('summer sale')).toBe('/category/summer%20sale')
    expect(buildCategoryHref('ropa-niños')).toBe('/category/ropa-ni%C3%B1os')
  })
})

describe('catalogHref', () => {
  it('returns / when landing is disabled', () => {
    expect(catalogHref(false)).toBe('/')
  })

  it('returns /shop when landing is enabled', () => {
    expect(catalogHref(true)).toBe('/shop')
  })

  it('returns / when landing is undefined (flag not loaded)', () => {
    expect(catalogHref(undefined)).toBe('/')
  })

  it('returns / when called with no argument', () => {
    expect(catalogHref()).toBe('/')
  })
})

// ─── buildPrimaryNavLinks ──────────────────────────────────────────────────────

function cfg(overrides: Partial<StoreConfig> = {}): StoreConfig {
  return {
    storeName: 'Test',
    landingEnabled: false,
    faqEnabled: false,
    blogEnabled: false,
    whatsappEnabled: false,
    reviewsEnabled: true,
    llmDiscoveryEnabled: true,
    ...overrides,
  } as StoreConfig
}

describe('buildPrimaryNavLinks', () => {
  it('returns only Track when all flags off', () => {
    const links = buildPrimaryNavLinks(cfg())
    expect(links).toEqual([{ href: '/track', labelKey: 'trackOrder' }])
  })

  it('returns only Track when config is null', () => {
    const links = buildPrimaryNavLinks(null)
    expect(links).toEqual([{ href: '/track', labelKey: 'trackOrder' }])
  })

  it('puts Shop first when landingEnabled=true', () => {
    const links = buildPrimaryNavLinks(cfg({ landingEnabled: true }))
    expect(links[0]).toEqual({ href: '/shop', labelKey: 'shopNav' })
    expect(links[1]).toEqual({ href: '/track', labelKey: 'trackOrder' })
  })

  it('includes FAQ when faqEnabled=true', () => {
    const links = buildPrimaryNavLinks(cfg({ faqEnabled: true }))
    const faq = links.find((l) => l.href === '/faq')
    expect(faq).toBeDefined()
    expect(faq!.labelKey).toBe('faqNav')
  })

  it('includes Blog when blogEnabled=true', () => {
    const links = buildPrimaryNavLinks(cfg({ blogEnabled: true }))
    const blog = links.find((l) => l.href === '/blog')
    expect(blog).toBeDefined()
    expect(blog!.labelKey).toBe('blogNav')
  })

  it('returns all four links in order when all flags on', () => {
    const links = buildPrimaryNavLinks(
      cfg({ landingEnabled: true, faqEnabled: true, blogEnabled: true }),
    )
    expect(links.map((l) => l.href)).toEqual(['/shop', '/track', '/faq', '/blog'])
  })

  it('omits FAQ when only blogEnabled', () => {
    const links = buildPrimaryNavLinks(cfg({ blogEnabled: true }))
    expect(links.find((l) => l.href === '/faq')).toBeUndefined()
  })

  it('omits Blog when only faqEnabled', () => {
    const links = buildPrimaryNavLinks(cfg({ faqEnabled: true }))
    expect(links.find((l) => l.href === '/blog')).toBeUndefined()
  })
})
