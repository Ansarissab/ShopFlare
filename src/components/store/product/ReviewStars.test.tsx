// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ReviewStars } from './ReviewStars'
import { en } from '@/lib/i18n/en'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ReviewStars — read-only', () => {
  it('has accessible aria-label with rating value', () => {
    render(<ReviewStars rating={3} />)
    const label = en.reviews.starsAriaLabel.replace('{rating}', '3')
    expect(screen.getByLabelText(label)).toBeTruthy()
  })

  it('renders 5 star icons', () => {
    const { container } = render(<ReviewStars rating={4} />)
    // lucide Star renders as SVG elements
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBe(5)
  })

  it('does not render buttons in read-only mode', () => {
    render(<ReviewStars rating={3} />)
    expect(screen.queryAllByRole('button').length).toBe(0)
  })
})

describe('ReviewStars — interactive', () => {
  it('renders as radiogroup with buttons', () => {
    render(<ReviewStars rating={0} onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    expect(screen.getAllByRole('button').length).toBe(5)
  })

  it('calls onChange with correct star value on click', () => {
    const onChange = vi.fn()
    render(<ReviewStars rating={0} onChange={onChange} />)
    // Click the 4-star button
    const fourStarBtn = screen.getByLabelText(en.reviews.starLabelPlural.replace('{count}', '4'))
    fireEvent.click(fourStarBtn)
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('calls onChange with 1 when clicking first star', () => {
    const onChange = vi.fn()
    render(<ReviewStars rating={0} onChange={onChange} />)
    const oneStarBtn = screen.getByLabelText(en.reviews.starLabel.replace('{count}', '1'))
    fireEvent.click(oneStarBtn)
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('interactive aria-label is selectRating string', () => {
    render(<ReviewStars rating={2} onChange={vi.fn()} />)
    expect(screen.getByLabelText(en.reviews.selectRating)).toBeTruthy()
  })
})
