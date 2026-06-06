// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { CustomersTab } from './CustomersTab'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { apiGet } from '@/lib/api'
import type { AnalyticsCustomersResponse } from '@/lib/types/analytics'

// Mirror the component's shortDate so the assertion is timezone-independent.
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/components/common/HelpTip', async () => {
  const { createElement } = await import('react')
  return { HelpTip: ({ text }: { text: string }) => createElement('span', { 'aria-label': text }) }
})

const fullData: AnalyticsCustomersResponse = {
  period: '30d',
  summary: {
    totalCustomers: 50,
    returningCustomers: 20,
    repeatRatePct: 40,
    avgClvCents: 75000,
  },
  topCustomers: [
    {
      customerKey: 'cust-abc',
      orders: 6,
      totalSpentCents: 120000,
      firstOrderAt: '2026-01-01T00:00:00Z',
      lastOrderAt: '2026-05-01T00:00:00Z',
    },
  ],
  rfmSegments: [
    { segment: 'champions', count: 5 },
    { segment: 'loyal', count: 8 },
    { segment: 'at_risk', count: 2 },
    // 'new' omitted on purpose to hit the `?? 0` fallback; 'other' omitted too
  ],
}

beforeEach(() => {
  vi.mocked(apiGet).mockResolvedValue(fullData)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CustomersTab', () => {
  it('shows skeleton while loading then fetches with period', async () => {
    let resolve!: (v: AnalyticsCustomersResponse) => void
    vi.mocked(apiGet).mockReturnValueOnce(new Promise(r => { resolve = r }))
    const { container } = render(<CustomersTab period="all" />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
    resolve(fullData)
    await screen.findByText(en.admin.analyticsTopCustomers)
    expect(apiGet).toHaveBeenCalledWith('/api/admin/analytics/customers?period=all')
  })

  it('renders no-data paragraph on fetch failure', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('nope'))
    render(<CustomersTab period="7d" />)
    await screen.findByText(en.admin.analyticsNoData)
  })

  it('renders stat cards with computed returning percentage and clv', async () => {
    render(<CustomersTab period="30d" />)
    await screen.findByText(en.admin.analyticsTotalCustomers)
    expect(screen.getByText('50')).toBeTruthy()
    expect(screen.getByText('20')).toBeTruthy()
    expect(screen.getByText('40% of total')).toBeTruthy() // 20/50
    expect(screen.getByText('40%')).toBeTruthy() // repeatRatePct
    expect(screen.getByText(formatPrice(75000))).toBeTruthy()
  })

  it('computes 0% returning when totalCustomers is 0', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({
      ...fullData,
      summary: { ...fullData.summary, totalCustomers: 0, returningCustomers: 0 },
    })
    render(<CustomersTab period="30d" />)
    await screen.findByText(en.admin.analyticsTotalCustomers)
    expect(screen.getByText('0% of total')).toBeTruthy()
  })

  it('renders all RFM segments in fixed order, missing ones default to 0', async () => {
    render(<CustomersTab period="30d" />)
    await screen.findByText(en.admin.analyticsRfmSegments)
    const champRow = screen.getByText(en.admin.analyticsSegmentChampions).closest('div')!
    expect(within(champRow).getByText('5')).toBeTruthy()
    expect(screen.getByText(en.admin.analyticsSegmentLoyal)).toBeTruthy()
    expect(screen.getByText(en.admin.analyticsSegmentAtRisk)).toBeTruthy()
    // new + other present but count 0 (fallback)
    const newRow = screen.getByText(en.admin.analyticsSegmentNew).closest('div')!
    expect(within(newRow).getByText('0')).toBeTruthy()
    expect(screen.getByText(en.admin.analyticsSegmentOther)).toBeTruthy()
  })

  it('renders top customer rows with formatted dates and spend', async () => {
    render(<CustomersTab period="30d" />)
    await screen.findByText(en.admin.analyticsTopCustomers)
    expect(screen.getByText('cust-abc')).toBeTruthy()
    expect(screen.getByText('6')).toBeTruthy()
    expect(screen.getByText(formatPrice(120000))).toBeTruthy()
    expect(screen.getByText(fmtDate('2026-01-01T00:00:00Z'))).toBeTruthy()
    expect(screen.getByText(fmtDate('2026-05-01T00:00:00Z'))).toBeTruthy()
  })

  it('renders empty-state for top customers when none', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({ ...fullData, topCustomers: [] })
    render(<CustomersTab period="30d" />)
    await screen.findByText(en.admin.analyticsTopCustomers)
    expect(screen.getByText(en.admin.analyticsNoData)).toBeTruthy()
  })
})
