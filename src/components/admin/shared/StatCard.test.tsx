// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StatCard } from './StatCard'

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) =>
      createElement('a', { href }, children),
  }
})

// HelpTip renders a tooltip button; mock it to avoid Radix portal issues
vi.mock('@/components/common/HelpTip', async () => {
  const { createElement } = await import('react')
  return {
    HelpTip: ({ text }: { text: string }) =>
      createElement('span', { 'data-helptip': text }, text),
  }
})

afterEach(cleanup)

describe('StatCard', () => {
  it('renders label and string value', () => {
    render(<StatCard label="Total Orders" value="42" />)
    expect(screen.getByText('Total Orders')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('renders label and numeric value', () => {
    render(<StatCard label="Revenue" value={15000} />)
    expect(screen.getByText('Revenue')).toBeTruthy()
    expect(screen.getByText('15000')).toBeTruthy()
  })

  it('renders sub text when provided', () => {
    render(<StatCard label="Pending" value="5" sub="awaiting confirmation" />)
    expect(screen.getByText('awaiting confirmation')).toBeTruthy()
  })

  it('does not render sub text when absent', () => {
    render(<StatCard label="Pending" value="5" />)
    expect(screen.queryByText('awaiting confirmation')).toBeNull()
  })

  it('wraps content in a link when href is provided', () => {
    render(<StatCard label="Orders" value="10" href="/admin/orders" />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/admin/orders')
  })

  it('does not render a link when no href is provided', () => {
    render(<StatCard label="Revenue" value="100" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders help tooltip text when help is provided (non-link card)', () => {
    render(<StatCard label="Low Stock" value="3" help="Items below threshold" />)
    expect(screen.getByText('Items below threshold')).toBeTruthy()
  })
})
