// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AdminSidebar, MobileAdminNav } from './AdminSidebar'
import { en } from '@/lib/i18n/en'

let mockPathname = '/admin'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      createElement('a', { href, ...rest }, children),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockPathname = '/admin'
})

describe('AdminSidebar', () => {
  it('renders all nav items by label', () => {
    render(<AdminSidebar />)
    expect(screen.getByText(en.admin.dashboard)).toBeTruthy()
    expect(screen.getByText(en.admin.products)).toBeTruthy()
    expect(screen.getByText(en.admin.coupons)).toBeTruthy()
    expect(screen.getByText(en.admin.settings)).toBeTruthy()
  })

  it('marks the dashboard active when pathname is exactly /admin', () => {
    mockPathname = '/admin'
    render(<AdminSidebar />)
    const dashLink = screen.getByText(en.admin.dashboard).closest('a')!
    expect(dashLink.className).toContain('text-primary')
  })

  it('does not mark dashboard active on a nested route (exact match only)', () => {
    mockPathname = '/admin/products'
    render(<AdminSidebar />)
    const dashLink = screen.getByText(en.admin.dashboard).closest('a')!
    expect(dashLink.className).not.toContain('text-primary')
    const productsLink = screen.getByText(en.admin.products).closest('a')!
    expect(productsLink.className).toContain('text-primary')
  })

  it('marks a non-dashboard item active via startsWith on nested route', () => {
    mockPathname = '/admin/products/abc-123'
    render(<AdminSidebar />)
    const productsLink = screen.getByText(en.admin.products).closest('a')!
    expect(productsLink.className).toContain('text-primary')
  })

  it('starts expanded showing the Admin title and collapse control', () => {
    render(<AdminSidebar />)
    expect(screen.getByText('Admin')).toBeTruthy()
    expect(screen.getByLabelText('Collapse sidebar')).toBeTruthy()
  })

  it('collapses and expands when the toggle button is clicked', () => {
    render(<AdminSidebar />)
    fireEvent.click(screen.getByLabelText('Collapse sidebar'))
    // Title hidden, labels hidden, expand control shown
    expect(screen.queryByText('Admin')).toBeNull()
    expect(screen.queryByText(en.admin.dashboard)).toBeNull()
    const expandBtn = screen.getByLabelText('Expand sidebar')
    expect(expandBtn).toBeTruthy()

    // collapsed link still rendered with title attribute = label
    const dashLink = document.querySelector('a[href="/admin"]')!
    expect(dashLink.getAttribute('title')).toBe(en.admin.dashboard)

    fireEvent.click(expandBtn)
    expect(screen.getByText('Admin')).toBeTruthy()
    expect(screen.getByText(en.admin.dashboard)).toBeTruthy()
  })
})

describe('MobileAdminNav', () => {
  it('renders a hamburger trigger and is closed by default', () => {
    render(<MobileAdminNav />)
    expect(screen.getByLabelText('Open navigation')).toBeTruthy()
    // Drawer content not present until opened
    expect(screen.queryByText(en.admin.dashboard)).toBeNull()
  })

  it('opens the drawer revealing nav items when the trigger is clicked', async () => {
    render(<MobileAdminNav />)
    fireEvent.click(screen.getByLabelText('Open navigation'))
    await vi.waitFor(() => {
      expect(screen.getByText(en.admin.dashboard)).toBeTruthy()
    })
  })

  it('closes the drawer when a nav link is clicked (onNavigate)', async () => {
    render(<MobileAdminNav />)
    fireEvent.click(screen.getByLabelText('Open navigation'))
    await vi.waitFor(() => expect(screen.getByText(en.admin.orders)).toBeTruthy())
    fireEvent.click(screen.getByText(en.admin.orders))
    await vi.waitFor(() => {
      expect(screen.queryByText(en.admin.orders)).toBeNull()
    })
  })
})
