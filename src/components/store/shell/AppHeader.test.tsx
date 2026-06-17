// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const openCart = vi.fn()
let isStandalone = true
let cartCount = 0
let storeConfig: { storeName?: string } | undefined = { storeName: 'My Shop' }

vi.mock('@/hooks/useDisplayMode', () => ({
  useIsStandalone: () => isStandalone,
}))

vi.mock('@/hooks/useCart', () => ({
  useCartItemCount: () => cartCount,
  useCart: (selector: (s: { openCart: () => void; lastAddedAt: number }) => unknown) =>
    selector({ openCart, lastAddedAt: 0 }),
}))

vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: storeConfig }),
}))

import { AppHeader } from './AppHeader'

beforeEach(() => {
  isStandalone = true
  cartCount = 0
  storeConfig = { storeName: 'My Shop' }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AppHeader', () => {
  it('renders nothing when not standalone', () => {
    isStandalone = false
    const { container } = render(<AppHeader />)
    expect(container.querySelector('[data-app-header]')).toBeNull()
  })

  it('renders header with store name in standalone mode', () => {
    render(<AppHeader />)
    expect(screen.getByText('My Shop')).toBeTruthy()
    expect(screen.getByLabelText('Open cart')).toBeTruthy()
  })

  it('falls back to "Store" when config is missing', () => {
    storeConfig = undefined
    render(<AppHeader />)
    expect(screen.getByText('Store')).toBeTruthy()
  })

  it('falls back to "Store" when storeName is absent', () => {
    storeConfig = {}
    render(<AppHeader />)
    expect(screen.getByText('Store')).toBeTruthy()
  })

  it('does not render the badge when cart is empty', () => {
    cartCount = 0
    const { container } = render(<AppHeader />)
    expect(container.querySelector('header span.absolute')).toBeNull()
  })

  it('renders the numeric badge when cart has items (<= 9)', () => {
    cartCount = 3
    render(<AppHeader />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('renders "9+" when cart count exceeds 9', () => {
    cartCount = 12
    render(<AppHeader />)
    expect(screen.getByText('9+')).toBeTruthy()
  })

  it('calls openCart when the cart button is clicked', () => {
    render(<AppHeader />)
    fireEvent.click(screen.getByLabelText('Open cart'))
    expect(openCart).toHaveBeenCalledTimes(1)
  })
})
