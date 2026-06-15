// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import AdminShortcuts from './AdminShortcuts'
import { ListNavProvider, useRegisterListNav } from './ListNavContext'

// ─── next/navigation mock ─────────────────────────────────────────────────────

const mockPush = vi.fn()
let mockPathname = '/admin/orders'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}))

// ─── i18n mock ────────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n/Provider', () => ({
  useT: () => ({
    shortcuts: {
      title: 'Keyboard shortcuts',
      sequenceHint: 'then',
      search: 'Search',
      help: 'Show this help',
      close: 'Close',
      goOrders: 'Go to orders',
      goProducts: 'Go to products',
      goCoupons: 'Go to coupons',
      goAnalytics: 'Go to analytics',
      create: 'Create new',
      listNext: 'Next item',
      listPrev: 'Previous item',
      listOpen: 'Open selected',
    },
  }),
  useLocale: () => 'en',
}))

// ─── shadcn dialog mock — renders children inline ─────────────────────────────

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ─── useReducedMotion mock ────────────────────────────────────────────────────

vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))

// ─── LOCALES mock ─────────────────────────────────────────────────────────────

vi.mock('@/lib/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants')>()
  return {
    ...actual,
    LOCALES: { en: { code: 'en', label: 'English', dir: 'ltr' } },
  }
})

// ─── helpers ──────────────────────────────────────────────────────────────────

function pressKey(key: string) {
  fireEvent.keyDown(window, { key })
}

function renderShortcuts() {
  return render(
    <ListNavProvider>
      <AdminShortcuts />
    </ListNavProvider>,
  )
}

// ─── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockPathname = '/admin/orders'
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('AdminShortcuts — navigation', () => {
  it('g → o navigates to /admin/orders', () => {
    renderShortcuts()
    pressKey('g')
    pressKey('o')
    expect(mockPush).toHaveBeenCalledWith('/admin/orders')
  })

  it('g → p navigates to /admin/products', () => {
    renderShortcuts()
    pressKey('g')
    pressKey('p')
    expect(mockPush).toHaveBeenCalledWith('/admin/products')
  })

  it('g → c navigates to /admin/coupons', () => {
    renderShortcuts()
    pressKey('g')
    pressKey('c')
    expect(mockPush).toHaveBeenCalledWith('/admin/coupons')
  })

  it('g → a navigates to /admin/analytics', () => {
    renderShortcuts()
    pressKey('g')
    pressKey('a')
    expect(mockPush).toHaveBeenCalledWith('/admin/analytics')
  })
})

describe('AdminShortcuts — create shortcut', () => {
  it('c on /admin/products pushes /admin/products/new', () => {
    mockPathname = '/admin/products'
    renderShortcuts()
    pressKey('c')
    expect(mockPush).toHaveBeenCalledWith('/admin/products/new')
  })

  it('c on /admin/orders is a no-op (no create route)', () => {
    mockPathname = '/admin/orders'
    renderShortcuts()
    pressKey('c')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('c on /admin/categories pushes /admin/categories/new', () => {
    mockPathname = '/admin/categories'
    renderShortcuts()
    pressKey('c')
    expect(mockPush).toHaveBeenCalledWith('/admin/categories/new')
  })
})

describe('AdminShortcuts — help overlay', () => {
  it('? opens the help overlay', () => {
    const { getByTestId } = renderShortcuts()
    pressKey('?')
    expect(getByTestId('dialog')).toBeTruthy()
  })

  it('Escape closes the help overlay', () => {
    const { getByTestId, queryByTestId } = renderShortcuts()
    pressKey('?')
    expect(getByTestId('dialog')).toBeTruthy()
    pressKey('Escape')
    expect(queryByTestId('dialog')).toBeNull()
  })
})

describe('AdminShortcuts — search shortcut', () => {
  it('/ focuses the [data-shortcut-search] element', () => {
    const { container } = renderShortcuts()
    // Mount a focusable search element in the document body
    const input = document.createElement('input')
    input.setAttribute('data-shortcut-search', '')
    container.appendChild(input)
    pressKey('/')
    expect(document.activeElement).toBe(input)
    container.removeChild(input)
  })

  it('/ is a no-op when no [data-shortcut-search] element is present', () => {
    renderShortcuts()
    // Should not throw and document.activeElement remains body/default
    expect(() => pressKey('/')).not.toThrow()
  })
})

describe('AdminShortcuts — list navigation shortcuts', () => {
  // Registers a stub controller into the shared ListNavContext ref
  function ControllerRegistrar({
    controller,
  }: {
    controller: { next: () => void; prev: () => void; open: () => void }
  }) {
    useRegisterListNav(controller)
    return null
  }

  it('j calls navRef.current.next() when a controller is registered', () => {
    const controller = { next: vi.fn(), prev: vi.fn(), open: vi.fn() }
    render(
      <ListNavProvider>
        <AdminShortcuts />
        <ControllerRegistrar controller={controller} />
      </ListNavProvider>,
    )
    pressKey('j')
    expect(controller.next).toHaveBeenCalledTimes(1)
  })

  it('k calls navRef.current.prev() when a controller is registered', () => {
    const controller = { next: vi.fn(), prev: vi.fn(), open: vi.fn() }
    render(
      <ListNavProvider>
        <AdminShortcuts />
        <ControllerRegistrar controller={controller} />
      </ListNavProvider>,
    )
    pressKey('k')
    expect(controller.prev).toHaveBeenCalledTimes(1)
  })

  it('Enter calls navRef.current.open() when a controller is registered', () => {
    const controller = { next: vi.fn(), prev: vi.fn(), open: vi.fn() }
    render(
      <ListNavProvider>
        <AdminShortcuts />
        <ControllerRegistrar controller={controller} />
      </ListNavProvider>,
    )
    pressKey('Enter')
    expect(controller.open).toHaveBeenCalledTimes(1)
  })

  it('j/k/Enter are no-ops when no controller is registered', () => {
    renderShortcuts()
    // Should not throw when navRef.current is null
    expect(() => {
      pressKey('j')
      pressKey('k')
      pressKey('Enter')
    }).not.toThrow()
  })
})
