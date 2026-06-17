/**
 * Regression test: /shop/<slug> must permanently redirect to /category/<slug>.
 * Without this route, landing-page CTAs that link to /shop/<category> 404.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const permanentRedirectMock = vi.fn()

vi.mock('next/navigation', () => ({
  permanentRedirect: (url: string) => permanentRedirectMock(url),
}))

// ── helpers ────────────────────────────────────────────────────────────────────

async function invokePage(slug: string) {
  const { default: ShopSlugRedirectPage } = await import('./page')
  await ShopSlugRedirectPage({ params: Promise.resolve({ slug }) })
}

// ── setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── tests ──────────────────────────────────────────────────────────────────────

describe('ShopSlugRedirectPage', () => {
  it('redirects /shop/accessories → /category/accessories', async () => {
    await invokePage('accessories')
    expect(permanentRedirectMock).toHaveBeenCalledWith('/category/accessories')
  })

  it('redirects /shop/apparel → /category/apparel', async () => {
    await invokePage('apparel')
    expect(permanentRedirectMock).toHaveBeenCalledWith('/category/apparel')
  })

  it('never redirects to /shop/<slug> (which has no canonical route)', async () => {
    await invokePage('accessories')
    expect(permanentRedirectMock).not.toHaveBeenCalledWith('/shop/accessories')
  })

  it('handles arbitrary slugs correctly', async () => {
    await invokePage('new-arrivals')
    expect(permanentRedirectMock).toHaveBeenCalledWith('/category/new-arrivals')
  })
})
