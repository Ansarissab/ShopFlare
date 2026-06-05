// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { InfiniteScrollSentinel } from './InfiniteScrollSentinel'
import { en } from '@/lib/i18n/en'

// jsdom has no IntersectionObserver — capture instances so a test can drive the
// intersection callback by hand.
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
    MockIntersectionObserver.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
  trigger(isIntersecting: boolean) {
    this.cb([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const lastObserver = () => MockIntersectionObserver.instances.at(-1)!

describe('InfiniteScrollSentinel', () => {
  it('calls onVisible when the sentinel intersects and is not loading', () => {
    const onVisible = vi.fn()
    render(
      <InfiniteScrollSentinel
        onVisible={onVisible}
        isLoading={false}
        hasMore
        totalItems={50}
        pageSize={24}
      />,
    )
    act(() => lastObserver().trigger(true))
    expect(onVisible).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onVisible while isLoading is true (idempotent guard)', () => {
    const onVisible = vi.fn()
    render(
      <InfiniteScrollSentinel
        onVisible={onVisible}
        isLoading={true}
        hasMore
        totalItems={50}
        pageSize={24}
      />,
    )
    act(() => lastObserver().trigger(true))
    expect(onVisible).not.toHaveBeenCalled()
  })

  it('does NOT call onVisible when the sentinel is not intersecting', () => {
    const onVisible = vi.fn()
    render(
      <InfiniteScrollSentinel
        onVisible={onVisible}
        isLoading={false}
        hasMore
        totalItems={50}
        pageSize={24}
      />,
    )
    act(() => lastObserver().trigger(false))
    expect(onVisible).not.toHaveBeenCalled()
  })

  it('renders nothing (and sets up no observer) when everything fits one page', () => {
    const onVisible = vi.fn()
    const { container } = render(
      <InfiniteScrollSentinel
        onVisible={onVisible}
        isLoading={false}
        hasMore={false}
        totalItems={10}
        pageSize={24}
      />,
    )
    expect(container.firstChild).toBeNull()
    expect(MockIntersectionObserver.instances).toHaveLength(0)
  })

  it('shows the "all loaded" message and observes nothing when hasMore is false', () => {
    const onVisible = vi.fn()
    render(
      <InfiniteScrollSentinel
        onVisible={onVisible}
        isLoading={false}
        hasMore={false}
        totalItems={50}
        pageSize={24}
      />,
    )
    expect(screen.queryByText(en.store.allProductsLoaded)).toBeTruthy()
    expect(MockIntersectionObserver.instances).toHaveLength(0)
  })

  it('shows the loading message while a batch is loading', () => {
    render(
      <InfiniteScrollSentinel
        onVisible={vi.fn()}
        isLoading={true}
        hasMore
        totalItems={50}
        pageSize={24}
      />,
    )
    expect(screen.queryByText(en.store.loadingMore)).toBeTruthy()
  })
})
