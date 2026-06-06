// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { FunnelTab } from './FunnelTab'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { apiGet } from '@/lib/api'
import type { AnalyticsFunnelResponse } from '@/lib/types/analytics'

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(() => Promise.resolve({})),
}))

// Avoid Radix/base-ui tooltip portal machinery — render a plain stand-in.
vi.mock('@/components/common/HelpTip', async () => {
  const { createElement } = await import('react')
  return { HelpTip: ({ text }: { text: string }) => createElement('span', { 'aria-label': text }) }
})

const layer2On: AnalyticsFunnelResponse = {
  period: '30d',
  funnelStages: [
    { stage: 'checkout', label: 'Checkouts Created', count: 100 },
    { stage: 'confirmed', label: 'Confirmed', count: 60 },
    { stage: 'delivered', label: 'Delivered', count: 30 },
  ],
  checkoutAbandonmentRatePct: 40,
  abandonedCheckouts: [
    { orderNumber: 'A-1', customerName: 'Jane Doe', contactHint: 'ja***@x.com', totalCents: 12000, createdAt: '', hoursAgo: 3 },
  ],
  layer2Enabled: true,
  layer2Stages: [
    { stage: 'product_view', label: 'ignored', count: 1000 },
    { stage: 'add_to_cart', label: 'ignored', count: 400 },
    { stage: 'checkout_start', label: 'ignored', count: 200 },
    { stage: 'purchase', label: 'ignored', count: 100 },
    { stage: 'mystery_stage', label: 'ignored', count: 0 },
  ],
  sampleRate: 0.25,
}

beforeEach(() => {
  vi.mocked(apiGet).mockResolvedValue(layer2On)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FunnelTab', () => {
  it('shows skeleton while loading then fetches with period', async () => {
    let resolve!: (v: AnalyticsFunnelResponse) => void
    vi.mocked(apiGet).mockReturnValueOnce(new Promise(r => { resolve = r }))
    const { container } = render(<FunnelTab period="90d" />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
    resolve(layer2On)
    await screen.findByText(en.admin.analyticsFunnel)
    expect(apiGet).toHaveBeenCalledWith('/api/admin/analytics/funnel?period=90d')
  })

  it('renders no-data on fetch failure', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('x'))
    render(<FunnelTab period="7d" />)
    await screen.findByText(en.admin.analyticsNoData)
  })

  it('renders layer-1 funnel stages with counts and percent of first', async () => {
    render(<FunnelTab period="30d" />)
    await screen.findByText(en.admin.analyticsFunnel)
    expect(screen.getByText('Checkouts Created')).toBeTruthy()
    expect(screen.getByText('Confirmed')).toBeTruthy()
    expect(screen.getByText('Delivered')).toBeTruthy()
    // 60/100 -> 60%
    expect(screen.getByText(/60 .* 60%/)).toBeTruthy()
  })

  it('renders abandonment rate stat card and abandoned checkout row', async () => {
    render(<FunnelTab period="30d" />)
    await screen.findByText(en.admin.analyticsAbandonmentRate)
    expect(screen.getByText('40% abandoned')).toBeTruthy()
    expect(screen.getByText('Jane Doe')).toBeTruthy()
    expect(screen.getByText('ja***@x.com')).toBeTruthy()
    expect(screen.getByText(formatPrice(12000))).toBeTruthy()
    expect(screen.getByText(en.admin.analyticsHoursAgo.replace('{n}', '3'))).toBeTruthy()
  })

  it('renders layer-2 funnel with mapped labels and sample-rate note', async () => {
    render(<FunnelTab period="30d" />)
    await screen.findByText(en.admin.analyticsFunnel)
    expect(screen.getByText(en.admin.analyticsFunnelViews)).toBeTruthy()
    expect(screen.getByText(en.admin.analyticsFunnelAddToCart)).toBeTruthy()
    expect(screen.getByText(en.admin.analyticsFunnelCheckoutStart)).toBeTruthy()
    expect(screen.getByText(en.admin.analyticsFunnelPurchased)).toBeTruthy()
    // default branch of layer2Label -> raw stage key
    expect(screen.getByText('mystery_stage')).toBeTruthy()
    // sample rate note: 0.25 -> 25
    expect(screen.getByText(en.admin.analyticsSampleRateNote.replace('{rate}', '25'))).toBeTruthy()
  })

  it('renders layer-2 off panel when disabled', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({ ...layer2On, layer2Enabled: false })
    render(<FunnelTab period="30d" />)
    await screen.findByText(en.admin.analyticsFunnelLayer2Off)
    expect(screen.getByText(en.admin.analyticsFunnelLayer2Hint)).toBeTruthy()
  })

  it('renders 0% when the first funnel stage count is zero (firstCount > 0 false branch)', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({
      ...layer2On,
      funnelStages: [
        { stage: 'checkout', label: 'Checkouts Created', count: 0 },
        { stage: 'confirmed', label: 'Confirmed', count: 0 },
      ],
    })
    render(<FunnelTab period="30d" />)
    await screen.findByText('Checkouts Created')
    // firstCount is 0 → ternary false branch → ofFirst forced to 0 (no divide-by-zero)
    expect(screen.getAllByText(/0 .* 0%/).length).toBeGreaterThan(0)
  })

  it('renders 0% for layer-2 when its first stage count is zero (firstL2Count > 0 false branch)', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({
      ...layer2On,
      layer2Stages: [
        { stage: 'product_view', label: 'ignored', count: 0 },
        { stage: 'add_to_cart', label: 'ignored', count: 0 },
      ],
    })
    render(<FunnelTab period="30d" />)
    await screen.findByText(en.admin.analyticsFunnelViews)
    // firstL2Count is 0 → ternary false branch → ofFirst forced to 0
    expect(screen.getAllByText(/0 .* 0%/).length).toBeGreaterThan(0)
  })

  it('shows no-data for empty funnel and empty abandoned and empty layer2 stages', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce({
      ...layer2On,
      funnelStages: [],
      abandonedCheckouts: [],
      layer2Stages: [],
    })
    render(<FunnelTab period="30d" />)
    await screen.findByText(en.admin.analyticsFunnel)
    // funnel empty + abandoned empty + layer2 empty = 3 no-data paragraphs
    const noData = screen.getAllByText(en.admin.analyticsNoData)
    expect(noData.length).toBe(3)
  })
})
