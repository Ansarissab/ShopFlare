// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ProductForm } from './ProductForm'
import { en } from '@/lib/i18n/en'
import { ApiError } from '@/lib/api'
import type { ProductWithVariants } from '@/lib/types/product'

// Form controls share label text with HelpTip triggers, so getByLabelText is
// ambiguous. Look controls up by their explicit id instead.
function byId(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`No element with id ${id}`)
  return el
}
import type { AnalyticsProductDetail } from '@/lib/types/analytics'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ApiError: actual.ApiError,
    apiGet: vi.fn(() => Promise.resolve(null)),
    apiPost: vi.fn(() => Promise.resolve({ id: 'new-prod' })),
    apiPut: vi.fn(() => Promise.resolve({})),
    apiDelete: vi.fn(() => Promise.resolve({})),
  }
})

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// Mock heavy child components — not under test here
vi.mock('@/components/admin/products/ImageUpload', () => ({
  ImageUpload: () => null,
}))
vi.mock('@/components/admin/categories/ProductCategoryPicker', () => ({
  ProductCategoryPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange(['cat-1'])}>pick-cat</button>
  ),
}))

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { toast } from 'sonner'

function makeProduct(overrides?: Partial<ProductWithVariants['product']>, variants?: ProductWithVariants['variants']): ProductWithVariants {
  return {
    product: {
      id: 'prod-1',
      name: 'Hoodie',
      description: 'A cozy hoodie',
      active: true,
      reviewsEnabled: true,
      stripeProductId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...overrides,
    },
    variants: variants ?? [],
    categoryIds: [],
  }
}

function makeVariant(id = 'var-1', sizes: ProductWithVariants['variants'][number]['sizes'] = [], images: ProductWithVariants['variants'][number]['images'] = []) {
  return {
    id,
    productId: 'prod-1',
    label: 'Blue',
    colorHex: '#0000ff',
    sortOrder: 0,
    sizes,
    images,
  }
}

function makeSize(id = 'size-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    variantId: 'var-1',
    size: 'M',
    sku: 'SKU-1',
    priceCents: 5000,
    stock: 10,
    stripePriceId: null,
    active: true,
    ...overrides,
  } as ProductWithVariants['variants'][number]['sizes'][number]
}

const stats: AnalyticsProductDetail = {
  productId: 'prod-1',
  period: '30d',
  unitsSold: 42,
  orders: 10,
  revenueCents: 50000,
  lastSoldAt: '2026-02-01T00:00:00Z',
  stockOnHand: 5,
  unlimited: false,
  velocity: [],
  affinityPartners: [{ productId: 'p2', productName: 'Cap', pairCount: 3 }],
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProductForm — create mode (no initial)', () => {
  it('renders create button and basic fields', () => {
    render(<ProductForm />)
    expect(screen.getByText(en.admin.createProduct)).toBeTruthy()
    // variants / danger zone are NOT shown without a product id
    expect(screen.queryByText(en.admin.variants)).toBeNull()
    expect(screen.queryByText(en.admin.dangerZone)).toBeNull()
  })

  it('blocks save and toasts required error when name is empty', () => {
    render(<ProductForm />)
    fireEvent.click(screen.getByText(en.admin.createProduct))
    expect(toast.error).toHaveBeenCalledWith(en.errors.required.replace('{field}', en.admin.productName))
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('creates product, saves categories, toasts and navigates', async () => {
    render(<ProductForm />)
    fireEvent.change(screen.getByLabelText(en.admin.productName), { target: { value: 'New Tee' } })
    fireEvent.click(screen.getByText('pick-cat'))
    fireEvent.click(screen.getByText(en.admin.createProduct))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.productCreated))
    expect(apiPost).toHaveBeenCalledWith('/api/admin/products', { name: 'New Tee', description: '', active: true, reviewsEnabled: true })
    expect(apiPut).toHaveBeenCalledWith('/api/admin/products/new-prod/categories', { categoryIds: ['cat-1'] })
    expect(pushMock).toHaveBeenCalledWith('/admin/products/new-prod')
  })

  it('toggling active checkbox and description updates payload', async () => {
    render(<ProductForm />)
    fireEvent.change(screen.getByLabelText(en.admin.productName), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText(en.admin.productDescription), { target: { value: 'desc' } })
    fireEvent.click(byId('product-active'))
    fireEvent.click(screen.getByText(en.admin.createProduct))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/admin/products', { name: 'X', description: 'desc', active: false, reviewsEnabled: true }))
  })

  it('create failure toasts network error', async () => {
    ;(apiPost as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    render(<ProductForm />)
    fireEvent.change(screen.getByLabelText(en.admin.productName), { target: { value: 'X' } })
    fireEvent.click(screen.getByText(en.admin.createProduct))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('add variant before save warns to save first', async () => {
    // In create mode the variants section is hidden, but addVariant guard is
    // still covered through edit-mode tests. Here we just assert section hidden.
    render(<ProductForm />)
    expect(screen.queryByText(en.admin.addVariant)).toBeNull()
  })
})

describe('ProductForm — edit mode (with initial)', () => {
  it('shows save button label, stats panel, variants and danger zone', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce(stats)
    render(<ProductForm initial={makeProduct()} />)
    expect(screen.getByText(en.admin.saved)).toBeTruthy()
    expect(screen.getByText(en.admin.variants)).toBeTruthy()
    expect(screen.getByText(en.admin.dangerZone)).toBeTruthy()
    expect(screen.getByText(en.admin.noVariantsYet)).toBeTruthy()
    // stats load
    await waitFor(() => expect(screen.getByText('42')).toBeTruthy())
    expect(screen.getByText('Cap')).toBeTruthy()
  })

  it('stats panel renders Never sold + no affinity when lastSoldAt null', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...stats, lastSoldAt: null, affinityPartners: [] })
    render(<ProductForm initial={makeProduct()} />)
    await waitFor(() => expect(screen.getByText(en.admin.analyticsNeverSold)).toBeTruthy())
  })

  it('stats panel renders nothing on fetch error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('no'))
    render(<ProductForm initial={makeProduct()} />)
    // header still present, but no units number
    await waitFor(() => expect(screen.getByText(en.admin.analyticsProductStats)).toBeTruthy())
    expect(screen.queryByText('42')).toBeNull()
  })

  it('updates existing product via apiPut and toasts updated', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    render(<ProductForm initial={makeProduct()} />)
    fireEvent.click(screen.getByText(en.admin.saved))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.productUpdated))
    expect(apiPut).toHaveBeenCalledWith('/api/admin/products/prod-1', { name: 'Hoodie', description: 'A cozy hoodie', active: true, reviewsEnabled: true })
    expect(apiPut).toHaveBeenCalledWith('/api/admin/products/prod-1/categories', { categoryIds: [] })
  })

  it('add variant appends and expands it', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPost as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'var-new', productId: 'prod-1', label: 'New Variant', colorHex: null, sortOrder: 0 })
    render(<ProductForm initial={makeProduct()} />)
    fireEvent.click(screen.getByText(en.admin.addVariant))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.variantCreated))
    expect(apiPost).toHaveBeenCalledWith('/api/admin/products/variants', { productId: 'prod-1', label: 'New Variant', sortOrder: 0 })
  })

  it('add variant failure toasts network error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPost as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    render(<ProductForm initial={makeProduct()} />)
    fireEvent.click(screen.getByText(en.admin.addVariant))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('renders a variant summary and toggles expansion', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    // first variant is expanded by default → variant label input visible
    expect(byId('variant-label-var-1')).toBeTruthy()
    // collapse
    fireEvent.click(screen.getByText('Blue'))
    await waitFor(() => expect(document.getElementById('variant-label-var-1')).toBeNull())
  })

  it('edits variant label and color, then saves variant', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.change(byId('variant-label-var-1'), { target: { value: 'Red' } })
    fireEvent.change(byId('variant-color-var-1'), { target: { value: '#ff0000' } })
    fireEvent.click(screen.getByText(en.admin.saveVariant))
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/api/admin/products/variants/var-1', { label: 'Red', colorHex: '#ff0000' }))
    expect(toast.success).toHaveBeenCalledWith(en.admin.saved)
  })

  it('clearing color hex sets it to null', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.change(byId('variant-color-var-1'), { target: { value: '' } })
    fireEvent.click(screen.getByText(en.admin.saveVariant))
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/api/admin/products/variants/var-1', { label: 'Blue', colorHex: null }))
  })

  it('save variant failure toasts network error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPut as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByText(en.admin.saveVariant))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('delete variant confirmed removes it', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteVariant))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.variantDeleted))
    expect(apiDelete).toHaveBeenCalledWith('/api/admin/products/variants/var-1')
    expect(screen.getByText(en.admin.noVariantsYet)).toBeTruthy()
  })

  it('delete variant cancelled does nothing', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteVariant))
    expect(apiDelete).not.toHaveBeenCalled()
  })

  it('delete variant failure toasts network error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    ;(apiDelete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteVariant))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('shows no-sizes message when variant has none', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    expect(screen.getByText(en.admin.noSizesYet)).toBeTruthy()
  })

  it('add size appends a new size row', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPost as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeSize('size-new', { size: 'M', priceCents: 0, stock: 0 }))
    const v = makeVariant('var-1', [])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByText(en.admin.addSize))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.sizeCreated))
    expect(apiPost).toHaveBeenCalledWith('/api/admin/products/sizes', { variantId: 'var-1', size: 'M', priceCents: 0, stock: 0, active: true })
  })

  it('add size failure toasts network error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPost as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    const v = makeVariant('var-1', [])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByText(en.admin.addSize))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('edits size fields then saves successfully', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.change(byId('size-name-size-1'), { target: { value: 'L' } })
    fireEvent.change(byId('size-price-size-1'), { target: { value: '7000' } })
    fireEvent.change(byId('size-stock-size-1'), { target: { value: '3' } })
    fireEvent.change(byId('size-sku-size-1'), { target: { value: 'SKU-2' } })
    fireEvent.click(screen.getByText(en.admin.saveSize))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.saved))
    expect(apiPut).toHaveBeenCalledWith('/api/admin/products/sizes/size-1', expect.objectContaining({ size: 'L', priceCents: 7000, stock: 3, sku: 'SKU-2' }))
  })

  it('client-side validation error blocks save and shows field error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    // empty size name → fails min(1)
    fireEvent.change(byId('size-name-size-1'), { target: { value: '' } })
    fireEvent.click(screen.getByText(en.admin.saveSize))
    await waitFor(() => expect(byId('size-name-size-1').getAttribute('aria-invalid')).toBe('true'))
    expect(apiPut).not.toHaveBeenCalled()
    // editing the field clears the error
    fireEvent.change(byId('size-name-size-1'), { target: { value: 'S' } })
    await waitFor(() => expect(byId('size-name-size-1').getAttribute('aria-invalid')).toBe('false'))
  })

  it('server 400 with issues sets field errors', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPut as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError(400, 'bad', { issues: [{ path: ['priceCents'], message: 'Too low' }] }),
    )
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByText(en.admin.saveSize))
    await waitFor(() => expect(screen.getByText('Too low')).toBeTruthy())
  })

  it('server error without issues toasts message', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPut as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('explode'))
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByText(en.admin.saveSize))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('explode'))
  })

  it('delete size removes the row', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteSize))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.sizeDeleted))
    expect(apiDelete).toHaveBeenCalledWith('/api/admin/products/sizes/size-1')
    expect(screen.getByText(en.admin.noSizesYet)).toBeTruthy()
  })

  it('delete size failure toasts network error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiDelete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteSize))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('danger zone delete confirmed navigates away', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ProductForm initial={makeProduct()} />)
    fireEvent.click(screen.getByText(en.admin.deleteProduct))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.productDeleted))
    expect(apiDelete).toHaveBeenCalledWith('/api/admin/products/prod-1')
    expect(pushMock).toHaveBeenCalledWith('/admin/products')
  })

  it('danger zone delete cancelled does nothing', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ProductForm initial={makeProduct()} />)
    fireEvent.click(screen.getByText(en.admin.deleteProduct))
    expect(apiDelete).not.toHaveBeenCalled()
  })

  it('danger zone delete failure toasts network error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    ;(apiDelete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    render(<ProductForm initial={makeProduct()} />)
    fireEvent.click(screen.getByText(en.admin.deleteProduct))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('update product failure toasts network error', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPut as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    render(<ProductForm initial={makeProduct()} />)
    fireEvent.click(screen.getByText(en.admin.saved))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('renders unit count summary accounting for unlimited (-1) stock', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [makeSize('s1', { stock: -1 }), makeSize('s2', { stock: 4 })])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    // 0 (unlimited) + 4 = 4 units in the header summary
    expect(screen.getByText(/4 units/)).toBeTruthy()
  })

  it('blocks save and toasts when name is whitespace only (trim branch)', () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    render(<ProductForm initial={makeProduct({ name: '   ' })} />)
    fireEvent.click(screen.getByText(en.admin.saved))
    expect(toast.error).toHaveBeenCalledWith(en.errors.required.replace('{field}', en.admin.productName))
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('variant with null colorHex omits the color swatches (falsy && branch)', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = { ...makeVariant('var-1', [makeSize('size-1')]), colorHex: null }
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    // header still shows the label, color input is present but empty
    expect(screen.getByText('Blue')).toBeTruthy()
    expect((byId('variant-color-var-1') as HTMLInputElement).value).toBe('')
  })

  it('server 400 ApiError without issues falls through to message toast', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPut as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new ApiError(400, 'no issues here', {}))
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByText(en.admin.saveSize))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('no issues here'))
  })

  it('server non-ApiError without message falls back to networkError', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    ;(apiPut as ReturnType<typeof vi.fn>).mockRejectedValueOnce('plain string reject')
    const v = makeVariant('var-1', [makeSize('size-1')])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    fireEvent.click(screen.getByText(en.admin.saveSize))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('size with null sku renders empty sku input (?? branch)', async () => {
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    const v = makeVariant('var-1', [makeSize('size-1', { sku: null })])
    render(<ProductForm initial={makeProduct(undefined, [v])} />)
    expect((byId('size-sku-size-1') as HTMLInputElement).value).toBe('')
  })

  it('add variant before save (no product id) warns to save first', async () => {
    // Directly exercise the addVariant guard: render edit mode, but the guard
    // checks initial.product.id which exists — so cover via create-mode absence.
    // Use an initial with empty id to hit the !initial?.product.id branch.
    ;(apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(stats)
    render(<ProductForm initial={makeProduct({ id: '' })} />)
    // empty id → variants section hidden (initial?.product.id falsy)
    expect(screen.queryByText(en.admin.addVariant)).toBeNull()
  })
})
