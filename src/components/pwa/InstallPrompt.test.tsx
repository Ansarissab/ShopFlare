// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import { InstallPrompt } from './InstallPrompt'
import { en } from '@/lib/i18n/en'
import { INSTALL_DISMISSED_KEY } from '@/lib/constants'

let standalone = false
vi.mock('@/hooks/useDisplayMode', () => ({
  useIsStandalone: () => standalone,
}))

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua })
}

function makeBeforeInstallEvent() {
  const evt = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  evt.prompt = vi.fn(() => Promise.resolve())
  return evt
}

beforeEach(() => {
  standalone = false
  localStorage.clear()
  setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
  vi.useRealTimers()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('InstallPrompt', () => {
  it('returns null when running in standalone display mode', () => {
    standalone = true
    const { container } = render(<InstallPrompt />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when already dismissed in localStorage', () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    const { container } = render(<InstallPrompt />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the Android/Desktop banner after beforeinstallprompt fires', () => {
    render(<InstallPrompt />)
    act(() => {
      window.dispatchEvent(makeBeforeInstallEvent())
    })
    expect(screen.getByText(en.pwa.installTitle)).toBeTruthy()
    expect(screen.getByText(en.pwa.installAction)).toBeTruthy()
  })

  it('install button prompts, accepts, marks dismissed and hides the banner', async () => {
    render(<InstallPrompt />)
    const evt = makeBeforeInstallEvent()
    ;(evt as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice = Promise.resolve({
      outcome: 'accepted',
    })
    act(() => {
      window.dispatchEvent(evt)
    })

    fireEvent.click(screen.getByText(en.pwa.installAction))
    expect((evt as unknown as { prompt: () => void }).prompt).toHaveBeenCalled()

    await waitFor(() => expect(screen.queryByText(en.pwa.installTitle)).toBeNull())
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1')
  })

  it('install button with dismissed outcome hides banner but does not persist dismissal flag from accept-path', async () => {
    render(<InstallPrompt />)
    const evt = makeBeforeInstallEvent()
    ;(evt as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice = Promise.resolve({
      outcome: 'dismissed',
    })
    act(() => {
      window.dispatchEvent(evt)
    })
    fireEvent.click(screen.getByText(en.pwa.installAction))
    await waitFor(() => expect(screen.queryByText(en.pwa.installTitle)).toBeNull())
    // not marked from the accepted branch
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBeNull()
  })

  it('dismiss button persists the dismissed flag and hides the banner', () => {
    render(<InstallPrompt />)
    act(() => {
      window.dispatchEvent(makeBeforeInstallEvent())
    })
    const dismissBtn = screen.getByText(en.pwa.installTitle).closest('div')
      ?.parentElement?.querySelectorAll('button')[1] as HTMLButtonElement
    fireEvent.click(dismissBtn)
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1')
    expect(screen.queryByText(en.pwa.installTitle)).toBeNull()
  })

  it('shows the iOS instruction sheet after the 3s delay on iOS', () => {
    vi.useFakeTimers()
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    render(<InstallPrompt />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText(en.pwa.installIosTitle)).toBeTruthy()
    expect(screen.getByText(en.pwa.installIosStep1)).toBeTruthy()
    expect(screen.getByText(en.pwa.installIosStep2)).toBeTruthy()
    expect(screen.getByText(en.pwa.installIosStep3)).toBeTruthy()
  })

  it('does not show the iOS sheet if dismissed during the delay', () => {
    vi.useFakeTimers()
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    render(<InstallPrompt />)
    // mark dismissed before the timer fires
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText(en.pwa.installIosTitle)).toBeNull()
  })

  it('closes the iOS sheet via the Close button and persists dismissal', () => {
    vi.useFakeTimers()
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    render(<InstallPrompt />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    // The visible outline close button (not the sheet's sr-only close icon).
    const closeBtn = screen
      .getAllByText(en.pwa.installIosClose)
      .map((el) => el.closest('button'))
      .find((btn) => btn && !btn.querySelector('.sr-only')) as HTMLButtonElement
    act(() => {
      fireEvent.click(closeBtn)
    })
    expect(localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1')
  })

  // ── Branch gap-fillers ──────────────────────────────────────────────────────

  it('treats localStorage.getItem throwing as not-dismissed (isDismissed catch branch)', () => {
    // Force getItem to throw → catch returns false → component renders/mounts.
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    render(<InstallPrompt />)
    // Not treated as dismissed: the banner can still appear when the native prompt fires.
    act(() => {
      window.dispatchEvent(makeBeforeInstallEvent())
    })
    expect(screen.getByText(en.pwa.installTitle)).toBeTruthy()
    getItemSpy.mockRestore()
  })

  it('swallows localStorage.setItem throwing on dismiss (markDismissed catch branch)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    render(<InstallPrompt />)
    act(() => {
      window.dispatchEvent(makeBeforeInstallEvent())
    })
    const dismissBtn = screen.getByText(en.pwa.installTitle).closest('div')
      ?.parentElement?.querySelectorAll('button')[1] as HTMLButtonElement
    // Click must not throw even though setItem throws inside markDismissed.
    expect(() => fireEvent.click(dismissBtn)).not.toThrow()
    expect(screen.queryByText(en.pwa.installTitle)).toBeNull()
    setItemSpy.mockRestore()
  })

  it('does not register the native prompt handler when standalone (effect guard returns early)', () => {
    standalone = true
    const addSpy = vi.spyOn(window, 'addEventListener')
    render(<InstallPrompt />)
    expect(addSpy).not.toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    addSpy.mockRestore()
  })

  it('removes the beforeinstallprompt listener on unmount (non-iOS cleanup path)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<InstallPrompt />)
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('clears the iOS timer + removes listener on unmount (iOS cleanup path)', () => {
    vi.useFakeTimers()
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render(<InstallPrompt />)
    // unmount BEFORE the 3s timer fires → iOS cleanup runs (removeEventListener + clearTimeout)
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    expect(clearSpy).toHaveBeenCalled()
    // timer was cancelled → advancing time must not surface the sheet
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText(en.pwa.installIosTitle)).toBeNull()
    removeSpy.mockRestore()
    clearSpy.mockRestore()
  })
})
