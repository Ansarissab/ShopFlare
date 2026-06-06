// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { OrderPushOptIn } from './OrderPushOptIn'
import { en } from '@/lib/i18n/en'

const enable = vi.fn(() => Promise.resolve(true))

let hookReturn: {
  supported: boolean
  permission: NotificationPermission
  enabled: boolean
  enable: typeof enable
  loading: boolean
}

vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => hookReturn,
}))

beforeEach(() => {
  hookReturn = {
    supported: true,
    permission: 'default',
    enabled: false,
    enable,
    loading: false,
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('OrderPushOptIn', () => {
  it('renders the opt-in card when supported and not yet enabled', () => {
    render(<OrderPushOptIn orderNumber="ORD-1" />)
    expect(screen.getByText(en.pwa.orderPushEnableTitle)).toBeTruthy()
    expect(screen.getByText(en.pwa.orderPushEnableBody)).toBeTruthy()
    expect(screen.getByText(en.pwa.orderPushEnableAction)).toBeTruthy()
  })

  it('returns null when push is unsupported', () => {
    hookReturn.supported = false
    const { container } = render(<OrderPushOptIn orderNumber="ORD-1" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when permission is denied', () => {
    hookReturn.permission = 'denied'
    const { container } = render(<OrderPushOptIn orderNumber="ORD-1" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when already enabled', () => {
    hookReturn.enabled = true
    const { container } = render(<OrderPushOptIn orderNumber="ORD-1" />)
    expect(container.firstChild).toBeNull()
  })

  it('calls enable when the action button is clicked', () => {
    render(<OrderPushOptIn orderNumber="ORD-1" />)
    fireEvent.click(screen.getByText(en.pwa.orderPushEnableAction))
    expect(enable).toHaveBeenCalledTimes(1)
  })

  it('shows the loading placeholder and disables the action while loading', () => {
    hookReturn.loading = true
    render(<OrderPushOptIn orderNumber="ORD-1" />)
    const actionBtn = screen.getByText('…').closest('button') as HTMLButtonElement
    expect(actionBtn).toBeTruthy()
    expect(actionBtn.disabled).toBe(true)
    expect(screen.queryByText(en.pwa.orderPushEnableAction)).toBeNull()
  })

  it('dismisses the card when the dismiss button is clicked', () => {
    render(<OrderPushOptIn orderNumber="ORD-1" />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText(en.pwa.orderPushEnableTitle)).toBeNull()
  })
})
