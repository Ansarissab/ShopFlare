// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FreeShippingBar } from './FreeShippingBar'
import { en } from '@/lib/i18n/en'

afterEach(cleanup)

describe('FreeShippingBar', () => {
  it('renders nothing when threshold is 0 (disabled)', () => {
    const { container } = render(
      <FreeShippingBar subtotalCents={500} thresholdCents={0} flatRateCents={300} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows progress message with remaining amount when below threshold', () => {
    render(
      <FreeShippingBar subtotalCents={500} thresholdCents={2000} flatRateCents={300} />,
    )
    // remaining = 1500 cents = ₨1,500 (PKR)
    expect(screen.getByText(/₨1,500/)).toBeTruthy()
    expect(screen.getByText(/free shipping/i)).toBeTruthy()
  })

  it('shows free shipping message when threshold is met', () => {
    render(
      <FreeShippingBar subtotalCents={2000} thresholdCents={2000} flatRateCents={300} />,
    )
    expect(screen.getByText(new RegExp(`${en.store.freeShipping}!`))).toBeTruthy()
  })

  it('shows free shipping message when subtotal exceeds threshold', () => {
    render(
      <FreeShippingBar subtotalCents={3000} thresholdCents={2000} flatRateCents={300} />,
    )
    expect(screen.getByText(new RegExp(`${en.store.freeShipping}!`))).toBeTruthy()
  })

  it('progress bar is present below threshold', () => {
    render(
      <FreeShippingBar subtotalCents={1000} thresholdCents={2000} flatRateCents={300} />,
    )
    expect(screen.getByRole('progressbar', { name: en.store.freeShipping })).toBeTruthy()
  })
})
