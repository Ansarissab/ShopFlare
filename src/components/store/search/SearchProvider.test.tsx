// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { SearchProvider, useSearchOverlay } from './SearchProvider'

// Mock next/dynamic to render the lazy overlay synchronously in tests
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    // Return a simple mock component that shows open state
    const MockOverlay = (props: { open: boolean; onOpenChange: (v: boolean) => void }) => {
      if (!props.open) return null
      return (
        <div data-testid="overlay">
          <button onClick={() => props.onOpenChange(false)}>Close overlay</button>
        </div>
      )
    }
    // Suppress unused warning — loader is intentionally not called in tests
    void loader
    return MockOverlay
  },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Helper consumer component ────────────────────────────────────────────────

function SearchConsumer() {
  const { open, openSearch, closeSearch } = useSearchOverlay()
  return (
    <div>
      <span data-testid="status">{open ? 'open' : 'closed'}</span>
      <button onClick={openSearch}>Open</button>
      <button onClick={closeSearch}>Close</button>
    </div>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchProvider + useSearchOverlay', () => {
  it('starts closed', () => {
    render(
      <SearchProvider>
        <SearchConsumer />
      </SearchProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('closed')
    expect(screen.queryByTestId('overlay')).toBeNull()
  })

  it('openSearch() makes open=true and renders overlay', () => {
    render(
      <SearchProvider>
        <SearchConsumer />
      </SearchProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByText('Open'))
    })
    expect(screen.getByTestId('status').textContent).toBe('open')
    expect(screen.getByTestId('overlay')).toBeTruthy()
  })

  it('closeSearch() sets open=false and hides overlay', () => {
    render(
      <SearchProvider>
        <SearchConsumer />
      </SearchProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByText('Open'))
    })
    expect(screen.getByTestId('status').textContent).toBe('open')

    act(() => {
      fireEvent.click(screen.getByText('Close'))
    })
    expect(screen.getByTestId('status').textContent).toBe('closed')
    expect(screen.queryByTestId('overlay')).toBeNull()
  })

  it('overlay onOpenChange(false) closes the overlay', () => {
    render(
      <SearchProvider>
        <SearchConsumer />
      </SearchProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByText('Open'))
    })
    act(() => {
      fireEvent.click(screen.getByText('Close overlay'))
    })
    expect(screen.getByTestId('status').textContent).toBe('closed')
  })

  it('useSearchOverlay throws outside SearchProvider', () => {
    function BadConsumer() {
      useSearchOverlay()
      return null
    }
    // Suppress React error boundary noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<BadConsumer />)).toThrow(
      'useSearchOverlay must be used inside <SearchProvider>',
    )
    consoleSpy.mockRestore()
  })

  it('overlay is not mounted until openSearch is called (lazy gate)', () => {
    // The dynamic chunk + search-index fetch must not fire on page hydration.
    // The overlay should only be in the DOM after the first openSearch() call.
    render(
      <SearchProvider>
        <SearchConsumer />
      </SearchProvider>,
    )
    // Before any open: overlay must not be in the DOM at all
    expect(screen.queryByTestId('overlay')).toBeNull()

    act(() => {
      fireEvent.click(screen.getByText('Open'))
    })
    // After first open: overlay is mounted and visible
    expect(screen.getByTestId('overlay')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByText('Close'))
    })
    // After close: overlay stays mounted (hasOpened=true) but hidden by open=false
    expect(screen.queryByTestId('overlay')).toBeNull()
  })
})
