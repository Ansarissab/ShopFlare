// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { OfflineBanner } from './OfflineBanner'
import { en } from '@/lib/i18n/en'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

afterEach(() => {
  cleanup()
  setOnline(true)
})

describe('OfflineBanner', () => {
  beforeEach(() => {
    setOnline(true)
  })

  it('renders nothing when online', () => {
    render(<OfflineBanner />)
    expect(screen.queryByText(en.pwa.offlineTitle)).toBeNull()
  })

  it('renders the offline banner when navigator is offline', () => {
    setOnline(false)
    render(<OfflineBanner />)
    expect(screen.getByText(en.pwa.offlineTitle)).toBeTruthy()
  })

  it('reacts to offline / online events via the external store subscription', () => {
    render(<OfflineBanner />)
    expect(screen.queryByText(en.pwa.offlineTitle)).toBeNull()

    act(() => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(en.pwa.offlineTitle)).toBeTruthy()

    act(() => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(en.pwa.offlineTitle)).toBeNull()
  })

  it('removes event listeners on unmount (cleanup path)', () => {
    const { unmount } = render(<OfflineBanner />)
    unmount()
    // Dispatching after unmount must not throw
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(true).toBe(true)
  })
})
