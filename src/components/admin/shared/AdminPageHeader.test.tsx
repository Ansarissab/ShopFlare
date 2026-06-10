// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AdminPageHeader } from './AdminPageHeader'

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
})

describe('AdminPageHeader', () => {
  it('renders the title as a heading', () => {
    render(<AdminPageHeader title="Coupons" />)
    expect(screen.getByRole('heading', { name: 'Coupons' })).toBeTruthy()
  })

  it('does not render a back link when backHref is absent', () => {
    render(<AdminPageHeader title="Coupons" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders a back link when backHref is provided', () => {
    render(<AdminPageHeader title="Edit" backHref="/admin/coupons" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/admin/coupons')
  })

  it('does not render the actions slot when actions is absent', () => {
    render(<AdminPageHeader title="Coupons" />)
    expect(screen.queryByTestId('action-btn')).toBeNull()
  })

  it('renders the actions slot when actions are provided', () => {
    render(
      <AdminPageHeader title="Coupons" actions={<button data-testid="action-btn">New</button>} />,
    )
    expect(screen.getByTestId('action-btn')).toBeTruthy()
  })
})
