// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { EnablePushButton } from './EnablePushButton'
import { en } from '@/lib/i18n/en'

const pushState = {
  supported: true,
  permission: 'default' as NotificationPermission,
  enabled: false,
  loading: false,
  enable: vi.fn(() => Promise.resolve(true)),
}

vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => pushState,
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import { toast } from 'sonner'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  // reset shared state
  pushState.supported = true
  pushState.permission = 'default'
  pushState.enabled = false
  pushState.loading = false
  pushState.enable = vi.fn(() => Promise.resolve(true))
})

describe('EnablePushButton', () => {
  it('shows unsupported message when not supported', () => {
    pushState.supported = false
    render(<EnablePushButton />)
    expect(screen.getByText(en.notifications.pushUnsupported)).toBeTruthy()
  })

  it('shows blocked message when permission is denied', () => {
    pushState.permission = 'denied'
    render(<EnablePushButton />)
    expect(screen.getByText(en.notifications.pushBlocked)).toBeTruthy()
  })

  it('shows enabled message when already enabled', () => {
    pushState.enabled = true
    render(<EnablePushButton />)
    expect(screen.getByText(en.notifications.pushEnabled)).toBeTruthy()
  })

  it('renders enable button when supported, not denied, not enabled', () => {
    render(<EnablePushButton />)
    expect(screen.getByRole('button', { name: en.notifications.enablePush })).toBeTruthy()
  })

  it('shows enabling label and disabled button while loading', () => {
    pushState.loading = true
    render(<EnablePushButton />)
    const btn = screen.getByRole('button', { name: en.notifications.enabling })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('click enable success toasts success', async () => {
    pushState.enable = vi.fn(() => Promise.resolve(true))
    render(<EnablePushButton />)
    fireEvent.click(screen.getByRole('button', { name: en.notifications.enablePush }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.notifications.pushEnabled))
    expect(pushState.enable).toHaveBeenCalled()
  })

  it('click enable failure toasts blocked error', async () => {
    pushState.enable = vi.fn(() => Promise.resolve(false))
    render(<EnablePushButton />)
    fireEvent.click(screen.getByRole('button', { name: en.notifications.enablePush }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.notifications.pushBlocked))
  })
})
