// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ReviewsSection } from './ReviewsSection'
import { en } from '@/lib/i18n/en'
import type { ProductReviewsResponse } from '@/lib/types/product'
import type { ApiResourceState } from '@/lib/types/common'

const useApiResource = vi.fn()
vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: (path: string) => useApiResource(path),
}))

vi.mock('@/components/store/product/ReviewStars', async () => {
  const { createElement } = await import('react')
  return {
    ReviewStars: ({ rating }: { rating: number }) =>
      createElement('div', { 'data-testid': 'stars', 'data-rating': rating }),
  }
})

// onSubmitted callback is invoked from the form — expose a trigger button.
vi.mock('@/components/store/product/ReviewForm', async () => {
  const { createElement } = await import('react')
  return {
    ReviewForm: ({
      onSubmitted,
      productId,
      productName,
    }: {
      onSubmitted: () => void
      productId: string
      productName: string
    }) =>
      createElement(
        'button',
        {
          'data-testid': 'submit-review',
          'data-product-id': productId,
          'data-product-name': productName,
          onClick: onSubmitted,
        },
        'mock-submit',
      ),
  }
})

function state(
  overrides: Partial<ApiResourceState<ProductReviewsResponse>>,
): ApiResourceState<ProductReviewsResponse> {
  return { data: null, loading: false, error: null, notFound: false, ...overrides }
}

const reviewsData: ProductReviewsResponse = {
  average: 4.5,
  count: 2,
  reviews: [
    {
      id: 'r1',
      customerName: 'Alice',
      rating: 5,
      body: 'Great product!',
      createdAt: '2024-01-02 10:00:00',
    },
    { id: 'r2', customerName: 'Bob', rating: 4, body: null, createdAt: '2024-01-03 10:00:00' },
  ],
}

beforeEach(() => {
  useApiResource.mockReturnValue(state({ data: reviewsData }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ReviewsSection', () => {
  it('renders the section title and write-review button', () => {
    render(<ReviewsSection productId="p1" productName="Hoodie" />)
    expect(screen.getByText(en.reviews.sectionTitle)).toBeTruthy()
    expect(screen.getByText(en.reviews.writeReview)).toBeTruthy()
  })

  it('queries the reviews endpoint for the product', () => {
    render(<ReviewsSection productId="abc" productName="Hoodie" />)
    expect(useApiResource).toHaveBeenCalledWith('/api/reviews/product/abc')
  })

  it('applies the className to the section element', () => {
    const { container } = render(
      <ReviewsSection productId="p1" productName="Hoodie" className="custom-cls" />,
    )
    expect(container.querySelector('section.custom-cls')).toBeTruthy()
  })

  it('toggles the review form open and hides the write-review button', () => {
    render(<ReviewsSection productId="p1" productName="Hoodie" />)
    fireEvent.click(screen.getByText(en.reviews.writeReview))
    expect(screen.getByTestId('submit-review')).toBeTruthy()
    expect(screen.queryByText(en.reviews.writeReview)).toBeNull()
    expect(screen.getByText(en.reviews.cancel)).toBeTruthy()
  })

  it('cancel button closes the form again', () => {
    render(<ReviewsSection productId="p1" productName="Hoodie" />)
    fireEvent.click(screen.getByText(en.reviews.writeReview))
    fireEvent.click(screen.getByText(en.reviews.cancel))
    expect(screen.queryByTestId('submit-review')).toBeNull()
    expect(screen.getByText(en.reviews.writeReview)).toBeTruthy()
  })

  it('closes the form when the form reports submission', () => {
    render(<ReviewsSection productId="p1" productName="Hoodie" />)
    fireEvent.click(screen.getByText(en.reviews.writeReview))
    fireEvent.click(screen.getByTestId('submit-review'))
    expect(screen.queryByTestId('submit-review')).toBeNull()
    expect(screen.getByText(en.reviews.writeReview)).toBeTruthy()
  })

  it('renders 3 skeletons while loading', () => {
    useApiResource.mockReturnValue(state({ loading: true }))
    const { container } = render(<ReviewsSection productId="p1" productName="Hoodie" />)
    // skeleton divs use the rounded-md class in this layout
    const skeletons = container.querySelectorAll('.h-16.w-full.rounded-md')
    expect(skeletons).toHaveLength(3)
  })

  it('renders a network error message when error is set', () => {
    useApiResource.mockReturnValue(state({ error: 'boom' }))
    render(<ReviewsSection productId="p1" productName="Hoodie" />)
    expect(screen.getByText(en.errors.networkError)).toBeTruthy()
  })

  it('renders the aggregate and review list when reviews exist', () => {
    render(<ReviewsSection productId="p1" productName="Hoodie" />)
    expect(screen.getByText(en.reviews.averageOf.replace('{average}', '4.5'))).toBeTruthy()
    expect(screen.getByText(en.reviews.basedOn.replace('{count}', '2'))).toBeTruthy()
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('Great product!')).toBeTruthy()
    // verified purchase label appears once per review
    expect(screen.getAllByText(en.reviews.verifiedPurchase)).toHaveLength(2)
  })

  it('omits the body paragraph when a review has no body', () => {
    render(<ReviewsSection productId="p1" productName="Hoodie" />)
    // Bob's review has body=null → no paragraph rendered, only Alice's body present
    expect(screen.queryByText('Great product!')).toBeTruthy()
    // No empty body text leaks; Bob still rendered by name
    expect(screen.getByText('Bob')).toBeTruthy()
  })

  it('renders the no-reviews message when count is 0', () => {
    useApiResource.mockReturnValue(state({ data: { average: 0, count: 0, reviews: [] } }))
    render(<ReviewsSection productId="p1" productName="Hoodie" />)
    expect(screen.getByText(en.reviews.noReviews)).toBeTruthy()
  })
})
