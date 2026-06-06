// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { StorefrontFooter } from './StorefrontFooter'
import { en } from '@/lib/i18n/en'

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      createElement('a', { href, ...rest }, children),
  }
})

let mockConfig: Record<string, unknown> | null = null
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig }),
}))

beforeEach(() => {
  mockConfig = null
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StorefrontFooter', () => {
  it('falls back to ShopFlare name with current year when no config', () => {
    render(<StorefrontFooter />)
    const year = new Date().getFullYear()
    expect(screen.getByText(`ShopFlare © ${year}`)).toBeTruthy()
  })

  it('uses store name from config when present', () => {
    mockConfig = { storeName: 'Acme Store' }
    render(<StorefrontFooter />)
    const year = new Date().getFullYear()
    expect(screen.getByText(`Acme Store © ${year}`)).toBeTruthy()
  })

  it('renders all four policy links with correct hrefs', () => {
    render(<StorefrontFooter />)
    const nav = screen.getByRole('navigation')

    const shipping = within(nav).getByText(en.policies.shipping)
    expect(shipping.getAttribute('href')).toBe('/policy/shipping')

    const returns = within(nav).getByText(en.policies.returns)
    expect(returns.getAttribute('href')).toBe('/policy/returns')

    const privacy = within(nav).getByText(en.policies.privacy)
    expect(privacy.getAttribute('href')).toBe('/policy/privacy')

    const terms = within(nav).getByText(en.policies.terms)
    expect(terms.getAttribute('href')).toBe('/policy/terms')
  })

  it('renders a contentinfo footer landmark', () => {
    render(<StorefrontFooter />)
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })
})
