// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useViewportPrefetch } from './useViewportPrefetch'
import { prefetch } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  prefetch: vi.fn(),
}))

// Capture the most recent IntersectionObserver instance so tests can drive its
// callback and assert observe/disconnect calls.
type IOCallback = (entries: { isIntersecting: boolean }[]) => void
let lastObserver: {
  cb: IOCallback
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  options: unknown
} | null = null

class MockIntersectionObserver {
  cb: IOCallback
  observe = vi.fn()
  disconnect = vi.fn()
  options: unknown
  constructor(cb: IOCallback, options: unknown) {
    this.cb = cb
    this.options = options
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- test mock captures the constructed instance
    lastObserver = this
  }
  // unused but part of the interface
  unobserve = vi.fn()
  takeRecords = vi.fn()
}

beforeEach(() => {
  lastObserver = null
  vi.stubGlobal(
    'IntersectionObserver',
    MockIntersectionObserver as unknown as typeof IntersectionObserver,
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

// Helper: render the hook and attach its ref to a real element so el is truthy.
function renderWithElement(path: string) {
  const el = document.createElement('div')
  const hook = renderHook(() => {
    const ref = useViewportPrefetch<HTMLDivElement>(path)
    // emulate React attaching the DOM node to the ref before effects run
    ref.current = el
    return ref
  })
  return { hook, el }
}

describe('useViewportPrefetch', () => {
  it('observes the element and uses a 200px rootMargin', () => {
    renderWithElement('/api/products/abc')
    expect(lastObserver).not.toBeNull()
    expect(lastObserver!.observe).toHaveBeenCalledWith(expect.any(HTMLElement))
    expect(lastObserver!.options).toEqual({ rootMargin: '200px' })
  })

  it('prefetches the path once on intersection then disconnects', () => {
    renderWithElement('/api/products/abc')
    act(() => {
      lastObserver!.cb([{ isIntersecting: true }])
    })
    expect(prefetch).toHaveBeenCalledWith('/api/products/abc')
    expect(prefetch).toHaveBeenCalledTimes(1)
    expect(lastObserver!.disconnect).toHaveBeenCalled()
  })

  it('does not prefetch when the entry is not intersecting', () => {
    renderWithElement('/api/products/abc')
    act(() => {
      lastObserver!.cb([{ isIntersecting: false }])
    })
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('disconnects on unmount (cleanup)', () => {
    const { hook } = renderWithElement('/api/products/abc')
    hook.unmount()
    expect(lastObserver!.disconnect).toHaveBeenCalled()
  })

  it('does nothing when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const { result } = renderHook(() => useViewportPrefetch('/api/x'))
    // ref still returned, no observer created, no prefetch
    expect(result.current).toBeDefined()
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('skips observing when ref element is null', () => {
    // Do not attach an element → ref.current stays null
    renderHook(() => useViewportPrefetch('/api/x'))
    expect(lastObserver).toBeNull()
    expect(prefetch).not.toHaveBeenCalled()
  })
})
