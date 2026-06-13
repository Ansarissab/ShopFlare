// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { ServiceWorkerProvider, useServiceWorker } from './ServiceWorkerProvider'
import { en } from '@/lib/i18n/en'

const toast = vi.fn()
vi.mock('sonner', () => ({ toast: (...args: unknown[]) => toast(...args) }))

// ---- Fake ServiceWorker primitives ----------------------------------------

type Listener = (e?: unknown) => void

function makeWorker(state = 'installed') {
  const listeners: Record<string, Listener[]> = {}
  return {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, cb: Listener) => {
      ;(listeners[type] ??= []).push(cb)
    }),
    emit(type: string) {
      ;(listeners[type] ?? []).forEach((cb) => cb())
    },
  }
}

function makeRegistration(
  opts: {
    waiting?: ReturnType<typeof makeWorker>
    installing?: ReturnType<typeof makeWorker>
  } = {},
) {
  const listeners: Record<string, Listener[]> = {}
  return {
    waiting: opts.waiting ?? null,
    installing: opts.installing ?? null,
    addEventListener: vi.fn((type: string, cb: Listener) => {
      ;(listeners[type] ??= []).push(cb)
    }),
    emit(type: string) {
      ;(listeners[type] ?? []).forEach((cb) => cb())
    },
  }
}

function installSW(
  opts: {
    registerImpl?: () => Promise<unknown>
  } = {},
) {
  const containerListeners: Record<string, Listener[]> = {}
  const register = vi.fn(opts.registerImpl ?? (() => Promise.resolve(makeRegistration())))
  const container = {
    controller: {} as ServiceWorker,
    register,
    addEventListener: vi.fn((type: string, cb: Listener) => {
      ;(containerListeners[type] ??= []).push(cb)
    }),
    emit(type: string) {
      ;(containerListeners[type] ?? []).forEach((cb) => cb())
    },
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: container,
  })
  return container
}

function removeSW() {
  // delete the property so 'serviceWorker' in navigator is false
  delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  removeSW()
})

describe('ServiceWorkerProvider', () => {
  it('renders children', () => {
    installSW()
    render(
      <ServiceWorkerProvider>
        <div>child-content</div>
      </ServiceWorkerProvider>,
    )
    expect(screen.getByText('child-content')).toBeTruthy()
  })

  it('does nothing when serviceWorker is unsupported', () => {
    removeSW()
    render(
      <ServiceWorkerProvider>
        <div>kid</div>
      </ServiceWorkerProvider>,
    )
    expect(screen.getByText('kid')).toBeTruthy()
    expect(toast).not.toHaveBeenCalled()
  })

  it('registers /sw.js on mount', async () => {
    const container = installSW()
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() => expect(container.register).toHaveBeenCalledWith('/sw.js'))
  })

  it('shows an update toast when the registration already has a waiting worker', async () => {
    const waiting = makeWorker()
    installSW({ registerImpl: () => Promise.resolve(makeRegistration({ waiting })) })
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(en.pwa.updateAvailable, expect.anything()),
    )
    // exercise the action onClick -> postMessage SKIP_WAITING
    const opts = toast.mock.calls[0][1] as { action: { onClick: () => void } }
    opts.action.onClick()
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('handles updatefound -> statechange installed with controller present', async () => {
    const installing = makeWorker('installing')
    const reg = makeRegistration({ installing })
    installSW({ registerImpl: () => Promise.resolve(reg) })
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() =>
      expect(reg.addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function)),
    )

    // trigger updatefound -> registers statechange listener on installing worker
    reg.emit('updatefound')
    expect(installing.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function))

    // move worker to installed and fire statechange -> toast
    installing.state = 'installed'
    installing.emit('statechange')
    expect(toast).toHaveBeenCalledWith(en.pwa.updateAvailable, expect.anything())
  })

  it('does not toast on statechange when worker is not yet installed (state branch)', async () => {
    const installing = makeWorker('installing')
    const reg = makeRegistration({ installing })
    installSW({ registerImpl: () => Promise.resolve(reg) })
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() =>
      expect(reg.addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function)),
    )
    reg.emit('updatefound')
    // statechange fires while still 'installing' → guard false → no toast
    installing.emit('statechange')
    expect(toast).not.toHaveBeenCalled()
  })

  it('does not toast on statechange when there is no controller (controller branch)', async () => {
    const installing = makeWorker('installing')
    const reg = makeRegistration({ installing })
    const container = installSW({ registerImpl: () => Promise.resolve(reg) })
    // Fresh install: no controlling SW yet.
    ;(container as unknown as { controller: ServiceWorker | null }).controller = null
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() =>
      expect(reg.addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function)),
    )
    reg.emit('updatefound')
    installing.state = 'installed'
    installing.emit('statechange')
    // installed but controller absent → guard false → no toast
    expect(toast).not.toHaveBeenCalled()
  })

  it('does not toast when the registration has no waiting worker (r.waiting falsy)', async () => {
    // default makeRegistration() has waiting=null → handleWaiting not called
    installSW({ registerImpl: () => Promise.resolve(makeRegistration()) })
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() => expect(toast).not.toHaveBeenCalled())
  })

  it('ignores updatefound when there is no installing worker', async () => {
    const reg = makeRegistration({ installing: undefined })
    installSW({ registerImpl: () => Promise.resolve(reg) })
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() =>
      expect(reg.addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function)),
    )
    reg.emit('updatefound')
    expect(toast).not.toHaveBeenCalled()
  })

  it('reloads on controllerchange (once)', async () => {
    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    })
    const container = installSW()
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() =>
      expect(container.addEventListener).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function),
      ),
    )
    container.emit('controllerchange')
    container.emit('controllerchange') // guarded by reloadingRef — still 1 call
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('defers registration until the load event when readyState is not complete', async () => {
    // Force document into a non-complete state before render.
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' })

    const container = installSW()
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )

    // Registration must NOT have fired yet — SW deferral is active.
    expect(container.register).not.toHaveBeenCalled()

    // Simulate the browser finishing loading.
    window.dispatchEvent(new Event('load'))

    // Registration must now be called with the correct SW path.
    await waitFor(() => expect(container.register).toHaveBeenCalledWith('/sw.js'))

    // Restore readyState so subsequent tests get jsdom's default.
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' })
  })

  it('swallows registration failures', async () => {
    const container = installSW({ registerImpl: () => Promise.reject(new Error('boom')) })
    render(
      <ServiceWorkerProvider>
        <div>x</div>
      </ServiceWorkerProvider>,
    )
    await waitFor(() => expect(container.register).toHaveBeenCalled())
    expect(toast).not.toHaveBeenCalled()
  })

  it('useServiceWorker exposes default context outside a provider', () => {
    let captured: ReturnType<typeof useServiceWorker> | undefined
    function Probe() {
      captured = useServiceWorker()
      return null
    }
    render(<Probe />)
    expect(captured).toEqual({ registration: null, updateAvailable: false })
  })
})
