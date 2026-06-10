// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react'
import { ProductsTab } from './ProductsTab'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { apiGet } from '@/lib/api'
import type { AnalyticsProductsResponse } from '@/lib/types/analytics'

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(() => Promise.resolve({})),
}))

const fullData: AnalyticsProductsResponse = {
  period: '30d',
  leaderboard: [
    {
      productId: 'p1',
      productName: 'Alpha Tee',
      orders: 5,
      unitsSold: 12,
      revenueCents: 30000,
      aovCents: 6000,
    },
    {
      productId: 'p2',
      productName: 'Beta Cap',
      orders: 9,
      unitsSold: 7,
      revenueCents: 50000,
      aovCents: 5555,
    },
    {
      productId: 'p3',
      productName: 'Gamma Bag',
      orders: 2,
      unitsSold: 30,
      revenueCents: 10000,
      aovCents: 5000,
    },
  ],
  variants: [
    { variantId: 'v1', variantLabel: 'Red', colorHex: '#ff0000', unitsSold: 4, revenueCents: 8000 },
    { variantId: 'v2', variantLabel: 'NoColor', colorHex: null, unitsSold: 1, revenueCents: 2000 },
  ],
  sizes: [{ sizeOptionId: 's1', size: 'M', unitsSold: 3, revenueCents: 6000 }],
  slowMovers: [
    {
      productId: 'sm1',
      productName: 'Dusty Sock',
      unitsSold: 0,
      stockOnHand: 40,
      unlimited: false,
      turnoverRatio: 0,
    },
    {
      productId: 'sm2',
      productName: 'Endless Item',
      unitsSold: 2,
      stockOnHand: 0,
      unlimited: true,
      turnoverRatio: 1.234,
    },
  ],
}

const emptyData: AnalyticsProductsResponse = {
  period: '30d',
  leaderboard: [],
  variants: [],
  sizes: [],
  slowMovers: [],
}

beforeEach(() => {
  vi.mocked(apiGet).mockResolvedValue(fullData)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProductsTab', () => {
  it('shows skeleton while loading then renders data (uses period in request)', async () => {
    let resolve!: (v: AnalyticsProductsResponse) => void
    vi.mocked(apiGet).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      }),
    )
    const { container } = render(<ProductsTab period="30d" />)
    // skeleton present (animate-pulse from Skeleton)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
    resolve(fullData)
    await screen.findByText(en.admin.analyticsLeaderboard)
    expect(apiGet).toHaveBeenCalledWith('/api/admin/analytics/products?period=30d')
  })

  it('renders no-data paragraph when fetch fails', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('boom'))
    render(<ProductsTab period="7d" />)
    await screen.findByText(en.admin.analyticsNoData)
  })

  it('renders leaderboard sorted by revenue by default', async () => {
    render(<ProductsTab period="30d" />)
    await screen.findByText(en.admin.analyticsLeaderboard)
    const rows = screen.getAllByRole('row')
    // header row + 3 data rows in leaderboard table (first table)
    expect(screen.getByText('Beta Cap')).toBeTruthy()
    // Beta Cap has highest revenue -> should be rank 1; find its row
    const betaRow = screen.getByText('Beta Cap').closest('tr')!
    expect(within(betaRow).getByText('1')).toBeTruthy()
    expect(rows.length).toBeGreaterThan(3)
  })

  it('resorts by units when Units button clicked', async () => {
    render(<ProductsTab period="30d" />)
    await screen.findByText(en.admin.analyticsLeaderboard)
    // sort buttons live in leaderboard header; click the Units one
    const unitsBtns = screen.getAllByRole('button', { name: en.admin.analyticsUnitsSold })
    fireEvent.click(unitsBtns[0])
    await waitFor(() => {
      const gammaRow = screen.getByText('Gamma Bag').closest('tr')!
      expect(within(gammaRow).getByText('1')).toBeTruthy()
    })
  })

  it('resorts by orders when Orders button clicked', async () => {
    render(<ProductsTab period="30d" />)
    await screen.findByText(en.admin.analyticsLeaderboard)
    const ordersBtns = screen.getAllByRole('button', { name: en.admin.analyticsOrders })
    fireEvent.click(ordersBtns[0])
    await waitFor(() => {
      const betaRow = screen.getByText('Beta Cap').closest('tr')!
      expect(within(betaRow).getByText('1')).toBeTruthy()
    })
  })

  it('renders variant rows with and without colorHex', async () => {
    const { container } = render(<ProductsTab period="30d" />)
    await screen.findByText(en.admin.analyticsVariantBreakdown)
    expect(screen.getByText('Red')).toBeTruthy()
    expect(screen.getByText('NoColor')).toBeTruthy()
    // colored swatch rendered for Red
    const swatch = container.querySelector('span[style*="background"]')
    expect(swatch).toBeTruthy()
  })

  it('renders size breakdown rows', async () => {
    render(<ProductsTab period="30d" />)
    await screen.findByText(en.admin.analyticsSizeBreakdown)
    expect(screen.getByText('M')).toBeTruthy()
  })

  it('renders slow movers, showing Unlimited and stock number + turnover', async () => {
    render(<ProductsTab period="30d" />)
    await screen.findByText(en.admin.analyticsSlowMovers)
    expect(screen.getByText('Dusty Sock')).toBeTruthy()
    expect(screen.getByText('Endless Item')).toBeTruthy()
    expect(screen.getByText(en.admin.analyticsUnlimited)).toBeTruthy()
    expect(screen.getByText('40')).toBeTruthy()
    expect(screen.getByText('1.23')).toBeTruthy() // turnoverRatio.toFixed(2)
    expect(screen.getByText('0.00')).toBeTruthy()
  })

  it('renders revenue/aov via formatPrice', async () => {
    render(<ProductsTab period="30d" />)
    await screen.findByText(en.admin.analyticsLeaderboard)
    expect(screen.getAllByText(formatPrice(50000)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(formatPrice(6000)).length).toBeGreaterThan(0)
  })

  it('shows empty-state paragraphs for empty leaderboard/variants/sizes and hides slow movers', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce(emptyData)
    render(<ProductsTab period="30d" />)
    await screen.findByText(en.admin.analyticsLeaderboard)
    const noData = screen.getAllByText(en.admin.analyticsNoData)
    // leaderboard + variants + sizes empty states = 3
    expect(noData.length).toBe(3)
    expect(screen.queryByText(en.admin.analyticsSlowMovers)).toBeNull()
  })
})
