// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { OrderTimeline } from './OrderTimeline'
import { en } from '@/lib/i18n/en'

afterEach(() => {
  cleanup()
})

describe('OrderTimeline — cancelled', () => {
  it('renders the cancelled badge + status label, no timeline steps', () => {
    render(<OrderTimeline status="cancelled" />)
    expect(screen.getByText(en.tracking.status)).toBeTruthy()
    expect(screen.getByText(en.orderStatusLabels.cancelled)).toBeTruthy()
    // timeline heading absent
    expect(screen.queryByText(en.tracking.timeline)).toBeNull()
    // none of the active step labels render
    expect(screen.queryByText(en.orderStatusLabels.pending)).toBeNull()
  })
})

describe('OrderTimeline — active timeline', () => {
  it('renders timeline heading and all five non-cancelled step labels', () => {
    render(<OrderTimeline status="pending" />)
    expect(screen.getByText(en.tracking.timeline)).toBeTruthy()
    expect(screen.getByText(en.orderStatusLabels.pending)).toBeTruthy()
    expect(screen.getByText(en.orderStatusLabels.confirmed)).toBeTruthy()
    expect(screen.getByText(en.orderStatusLabels.processing)).toBeTruthy()
    expect(screen.getByText(en.orderStatusLabels.shipped)).toBeTruthy()
    expect(screen.getByText(en.orderStatusLabels.delivered)).toBeTruthy()
    expect(screen.queryByText(en.orderStatusLabels.cancelled)).toBeNull() // not present
  })

  it('renders exactly 5 list items', () => {
    render(<OrderTimeline status="processing" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('marks completed / current / upcoming states by class color (status=processing)', () => {
    render(<OrderTimeline status="processing" />)
    // pending + confirmed are before processing → completed (success color)
    expect(screen.getByText(en.orderStatusLabels.pending).className).toContain('text-(--success)')
    expect(screen.getByText(en.orderStatusLabels.confirmed).className).toContain('text-(--success)')
    // processing is current → accent color
    expect(screen.getByText(en.orderStatusLabels.processing).className).toContain('text-(--accent)')
    // shipped + delivered after → upcoming (muted)
    expect(screen.getByText(en.orderStatusLabels.shipped).className).toContain('text-(--muted-fg)')
    expect(screen.getByText(en.orderStatusLabels.delivered).className).toContain(
      'text-(--muted-fg)',
    )
  })

  it('first step current when status=pending (no completed steps)', () => {
    render(<OrderTimeline status="pending" />)
    expect(screen.getByText(en.orderStatusLabels.pending).className).toContain('text-(--accent)')
  })

  it('all completed when status=delivered (last step current)', () => {
    render(<OrderTimeline status="delivered" />)
    expect(screen.getByText(en.orderStatusLabels.pending).className).toContain('text-(--success)')
    expect(screen.getByText(en.orderStatusLabels.shipped).className).toContain('text-(--success)')
    expect(screen.getByText(en.orderStatusLabels.delivered).className).toContain('text-(--accent)')
  })
})

describe('OrderTimeline — shipped tracking info', () => {
  function shippedLi(): HTMLElement {
    // the <li> containing the shipped label
    const label = screen.getByText(en.orderStatusLabels.shipped)
    return label.closest('li') as HTMLElement
  }

  it('shows carrier + tracking number when shipped step is current/completed', () => {
    render(<OrderTimeline status="shipped" trackingNumber="TRK123" carrier="DHL" />)
    const li = shippedLi()
    expect(within(li).getByText(`${en.tracking.carrier}: DHL`)).toBeTruthy()
    expect(within(li).getByText('TRK123')).toBeTruthy()
  })

  it('shows carrier only (no tracking number)', () => {
    render(<OrderTimeline status="delivered" carrier="FedEx" />)
    const li = shippedLi()
    expect(within(li).getByText(`${en.tracking.carrier}: FedEx`)).toBeTruthy()
    expect(within(li).queryByText(en.tracking.trackingNumber, { exact: false })).toBeNull()
  })

  it('shows tracking number only (no carrier)', () => {
    render(<OrderTimeline status="shipped" trackingNumber="ZZZ999" />)
    const li = shippedLi()
    expect(within(li).getByText('ZZZ999')).toBeTruthy()
    expect(within(li).queryByText(`${en.tracking.carrier}:`, { exact: false })).toBeNull()
  })

  it('does NOT show tracking block when shipped step is still upcoming', () => {
    render(<OrderTimeline status="confirmed" trackingNumber="TRK123" carrier="DHL" />)
    const li = shippedLi()
    expect(within(li).queryByText('TRK123')).toBeNull()
    expect(within(li).queryByText(`${en.tracking.carrier}: DHL`)).toBeNull()
  })

  it('does NOT show tracking block when neither carrier nor tracking number given', () => {
    render(<OrderTimeline status="shipped" />)
    const li = shippedLi()
    expect(within(li).queryByText(en.tracking.carrier, { exact: false })).toBeNull()
    expect(within(li).queryByText(en.tracking.trackingNumber, { exact: false })).toBeNull()
  })
})
