// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { TurnstileWidget } from './TurnstileWidget'

type RenderOpts = {
  sitekey: string
  callback: (token: string) => void
  'error-callback': () => void
  'expired-callback': () => void
  theme?: string
}

let lastOpts: RenderOpts | null = null
const renderFn = vi.fn((_el: HTMLElement | string, opts: RenderOpts) => {
  lastOpts = opts
  return 'widget-123'
})
const removeFn = vi.fn()
const resetFn = vi.fn()

function installTurnstile() {
  ;(window as unknown as { turnstile?: unknown }).turnstile = {
    render: renderFn,
    remove: removeFn,
    reset: resetFn,
  }
}

beforeEach(() => {
  lastOpts = null
  document.head.innerHTML = ''
  delete (window as unknown as { turnstile?: unknown }).turnstile
  delete (window as unknown as { onTurnstileLoad?: unknown }).onTurnstileLoad
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TurnstileWidget', () => {
  it('renders a container div with mt-2 class', () => {
    const { container } = render(<TurnstileWidget onVerify={vi.fn()} />)
    const div = container.querySelector('div.mt-2')
    expect(div).toBeTruthy()
  })

  it('renders the widget immediately when turnstile script already loaded', () => {
    installTurnstile()
    render(<TurnstileWidget onVerify={vi.fn()} />)
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('wires onVerify to the success callback', () => {
    installTurnstile()
    const onVerify = vi.fn()
    render(<TurnstileWidget onVerify={onVerify} />)
    lastOpts?.callback('tok-abc')
    expect(onVerify).toHaveBeenCalledWith('tok-abc')
  })

  it('calls onError on error-callback and expired-callback', () => {
    installTurnstile()
    const onError = vi.fn()
    render(<TurnstileWidget onVerify={vi.fn()} onError={onError} />)
    lastOpts?.['error-callback']()
    lastOpts?.['expired-callback']()
    expect(onError).toHaveBeenCalledTimes(2)
  })

  it('does not throw when onError is omitted (optional chaining)', () => {
    installTurnstile()
    render(<TurnstileWidget onVerify={vi.fn()} />)
    expect(() => {
      lastOpts?.['error-callback']()
      lastOpts?.['expired-callback']()
    }).not.toThrow()
  })

  it('injects the turnstile script when not yet present and renders via onload callback', () => {
    render(<TurnstileWidget onVerify={vi.fn()} />)
    const script = document.querySelector('script[src*="turnstile"]') as HTMLScriptElement | null
    expect(script).toBeTruthy()
    expect(script?.async).toBe(true)
    expect(script?.defer).toBe(true)
    // onload callback registered
    const onLoad = (window as unknown as { onTurnstileLoad?: () => void }).onTurnstileLoad
    expect(typeof onLoad).toBe('function')

    // simulate script finishing load
    installTurnstile()
    onLoad?.()
    expect(renderFn).toHaveBeenCalledTimes(1)
  })

  it('does not inject a second script when one already exists', () => {
    const existing = document.createElement('script')
    existing.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    document.head.appendChild(existing)

    render(<TurnstileWidget onVerify={vi.fn()} />)
    const scripts = document.querySelectorAll('script[src*="turnstile"]')
    expect(scripts.length).toBe(1)
  })

  it('removes the widget on unmount when rendered via the script-load callback', () => {
    // Script-injection path registers the cleanup that calls remove.
    render(<TurnstileWidget onVerify={vi.fn()} />)
    const onLoad = (window as unknown as { onTurnstileLoad?: () => void }).onTurnstileLoad
    installTurnstile()
    onLoad?.()
    cleanup()
    expect(removeFn).toHaveBeenCalledWith('widget-123')
  })

  it('does not call remove on unmount when no widget was rendered', () => {
    // turnstile never installed → renderWidget never sets widgetId
    const { unmount } = render(<TurnstileWidget onVerify={vi.fn()} />)
    unmount()
    expect(removeFn).not.toHaveBeenCalled()
  })

  it('renderWidget is a no-op when called twice (already rendered guard)', () => {
    render(<TurnstileWidget onVerify={vi.fn()} />)
    const onLoad = (window as unknown as { onTurnstileLoad?: () => void }).onTurnstileLoad
    installTurnstile()
    onLoad?.()
    onLoad?.() // second invocation hits the widgetIdRef guard
    expect(renderFn).toHaveBeenCalledTimes(1)
  })
})
