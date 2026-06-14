// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PrimaryNav } from './PrimaryNav'
import { en } from '@/lib/i18n/en'
import type { PrimaryNavLink } from '@/lib/nav'

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      createElement('a', { href, ...rest }, children),
  }
})

// useT returns the English dictionary by default (no context needed in tests)
vi.mock('@/lib/i18n/Provider', () => ({
  useT: () => en,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function link(href: string, labelKey: PrimaryNavLink['labelKey']): PrimaryNavLink {
  return { href, labelKey }
}

const TRACK = link('/track', 'trackOrder')
const SHOP = link('/shop', 'shopNav')
const FAQ = link('/faq', 'faqNav')
const BLOG = link('/blog', 'blogNav')

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PrimaryNav', () => {
  it('renders nothing when links array is empty', () => {
    const { container } = render(<PrimaryNav links={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders Track Order link always', () => {
    render(<PrimaryNav links={[TRACK]} />)
    const a = screen.getByText(en.store.trackOrder)
    expect(a.getAttribute('href')).toBe('/track')
  })

  it('renders Shop link and uses store.shopNav label', () => {
    render(<PrimaryNav links={[SHOP, TRACK]} />)
    const a = screen.getByText(en.store.shopNav)
    expect(a.getAttribute('href')).toBe('/shop')
  })

  it('renders FAQ link when present', () => {
    render(<PrimaryNav links={[TRACK, FAQ]} />)
    const a = screen.getByText(en.store.faqNav)
    expect(a.getAttribute('href')).toBe('/faq')
  })

  it('renders Blog link when present', () => {
    render(<PrimaryNav links={[TRACK, BLOG]} />)
    const a = screen.getByText(en.store.blogNav)
    expect(a.getAttribute('href')).toBe('/blog')
  })

  it('does not render Shop when not in links array', () => {
    render(<PrimaryNav links={[TRACK]} />)
    expect(screen.queryByText(en.store.shopNav)).toBeNull()
  })

  it('does not render FAQ when not in links array', () => {
    render(<PrimaryNav links={[TRACK]} />)
    expect(screen.queryByText(en.store.faqNav)).toBeNull()
  })

  it('does not render Blog when not in links array', () => {
    render(<PrimaryNav links={[TRACK]} />)
    expect(screen.queryByText(en.store.blogNav)).toBeNull()
  })

  it('renders all four links in order when all provided', () => {
    render(<PrimaryNav links={[SHOP, TRACK, FAQ, BLOG]} />)
    const anchors = screen.getAllByRole('link')
    const hrefs = anchors.map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/shop', '/track', '/faq', '/blog'])
  })

  it('has accessible nav label', () => {
    render(<PrimaryNav links={[TRACK]} />)
    expect(screen.getByRole('navigation', { name: en.store.menu })).toBeTruthy()
  })
})
