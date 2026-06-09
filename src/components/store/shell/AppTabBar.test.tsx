// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { en } from '@/lib/i18n/en'

const openCart = vi.fn()
const vibrate = vi.fn()
let isStandalone = true
let cartCount = 0
let pathname = '/'
let landingEnabled: boolean | undefined = undefined

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({
      href,
      children,
      onClick,
      ...rest
    }: {
      href: string
      children: React.ReactNode
      onClick?: () => void
    }) => createElement('a', { href, onClick, ...rest }, children),
  }
})

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('@/hooks/useDisplayMode', () => ({
  useIsStandalone: () => isStandalone,
}))

vi.mock('@/hooks/useCart', () => ({
  useCartItemCount: () => cartCount,
  useCart: (selector: (s: { openCart: () => void }) => unknown) => selector({ openCart }),
}))

vi.mock('@/lib/utils/haptics', () => ({
  vibrate: (...args: unknown[]) => vibrate(...args),
}))

vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: landingEnabled !== undefined ? { landingEnabled } : undefined, loading: false }),
}))

import { AppTabBar } from './AppTabBar'

beforeEach(() => {
  isStandalone = true
  cartCount = 0
  pathname = '/'
  landingEnabled = undefined
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AppTabBar', () => {
  it('renders nothing when not standalone', () => {
    isStandalone = false
    const { container } = render(<AppTabBar />)
    expect(container.querySelector('[data-tab-bar]')).toBeNull()
  })

  it('renders all five tabs in standalone mode', () => {
    render(<AppTabBar />)
    expect(screen.getByText(en.pwa.tabHome)).toBeTruthy()
    expect(screen.getByText(en.pwa.tabShop)).toBeTruthy()
    expect(screen.getByText(en.pwa.tabCart)).toBeTruthy()
    expect(screen.getByText(en.pwa.tabTrack)).toBeTruthy()
    expect(screen.getByText(en.pwa.tabMenu)).toBeTruthy()
  })

  it('renders link tabs with correct hrefs (landing off → shop = /)', () => {
    landingEnabled = false
    render(<AppTabBar />)
    expect(screen.getByLabelText(en.pwa.tabHome).getAttribute('href')).toBe('/')
    expect(screen.getByLabelText(en.pwa.tabShop).getAttribute('href')).toBe('/')
    expect(screen.getByLabelText(en.pwa.tabTrack).getAttribute('href')).toBe('/track')
    expect(screen.getByLabelText(en.pwa.tabMenu).getAttribute('href')).toBe('/#menu')
  })

  it('shop tab href is /shop when landing is enabled', () => {
    landingEnabled = true
    render(<AppTabBar />)
    expect(screen.getByLabelText(en.pwa.tabShop).getAttribute('href')).toBe('/shop')
  })

  it('cart tab is a button (no href) and calls vibrate + openCart on click', () => {
    render(<AppTabBar />)
    const cartBtn = screen.getByLabelText(en.pwa.tabCart)
    expect(cartBtn.tagName).toBe('BUTTON')
    fireEvent.click(cartBtn)
    expect(vibrate).toHaveBeenCalledWith('light')
    expect(openCart).toHaveBeenCalledTimes(1)
  })

  it('link tab click triggers vibrate', () => {
    render(<AppTabBar />)
    fireEvent.click(screen.getByLabelText(en.pwa.tabShop))
    expect(vibrate).toHaveBeenCalledWith('light')
  })

  it('does not render cart badge when count is 0', () => {
    cartCount = 0
    render(<AppTabBar />)
    expect(screen.queryByText('9+')).toBeNull()
    // numeric badge absent
    const cartBtn = screen.getByLabelText(en.pwa.tabCart)
    expect(cartBtn.querySelector('span.absolute')).toBeNull()
  })

  it('renders numeric cart badge when count between 1 and 9', () => {
    cartCount = 5
    render(<AppTabBar />)
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('renders "9+" badge when count exceeds 9', () => {
    cartCount = 20
    render(<AppTabBar />)
    expect(screen.getByText('9+')).toBeTruthy()
  })

  it('marks home tab active on exact path match', () => {
    pathname = '/'
    render(<AppTabBar />)
    const homeLabel = screen.getByText(en.pwa.tabHome)
    expect(homeLabel.className).toContain('text-primary')
  })

  it('marks shop tab active on /shop nested path when landing enabled', () => {
    landingEnabled = true
    pathname = '/shop/somecat'
    render(<AppTabBar />)
    const shopLabel = screen.getByText(en.pwa.tabShop)
    expect(shopLabel.className).toContain('text-primary')
  })

  it('keeps tabs inactive on unrelated path', () => {
    pathname = '/track'
    render(<AppTabBar />)
    const homeLabel = screen.getByText(en.pwa.tabHome)
    expect(homeLabel.className).toContain('text-muted-foreground')
  })
})
