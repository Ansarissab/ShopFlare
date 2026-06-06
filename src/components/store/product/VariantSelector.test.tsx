// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { VariantSelector } from './VariantSelector'
import { en } from '@/lib/i18n/en'
import type { Variant } from '@/lib/types/product'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function makeVariant(over: Partial<Variant> = {}): Variant {
  return {
    id: 'var-1',
    productId: 'prod-1',
    label: 'Blue',
    colorHex: '#0000ff',
    position: 0,
    ...over,
  } as Variant
}

describe('VariantSelector', () => {
  it('returns null when there are no variants', () => {
    const { container } = render(
      <VariantSelector variants={[]} selectedVariantId="" onSelect={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the select-variant label and a button per variant', () => {
    render(
      <VariantSelector
        variants={[makeVariant(), makeVariant({ id: 'var-2', label: 'Red', colorHex: '#ff0000' })]}
        selectedVariantId="var-1"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText(en.store.selectVariant)).toBeTruthy()
    expect(screen.getByText('Blue')).toBeTruthy()
    expect(screen.getByText('Red')).toBeTruthy()
  })

  it('marks the selected variant with aria-pressed', () => {
    render(
      <VariantSelector
        variants={[makeVariant(), makeVariant({ id: 'var-2', label: 'Red' })]}
        selectedVariantId="var-1"
        onSelect={vi.fn()}
      />,
    )
    const selected = screen.getByText('Blue').closest('button')!
    const other = screen.getByText('Red').closest('button')!
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(other.getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onSelect with the variant id on click', () => {
    const onSelect = vi.fn()
    render(
      <VariantSelector
        variants={[makeVariant({ id: 'var-9', label: 'Green' })]}
        selectedVariantId=""
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByText('Green'))
    expect(onSelect).toHaveBeenCalledWith('var-9')
  })

  it('renders the color swatch when colorHex is present', () => {
    const { container } = render(
      <VariantSelector
        variants={[makeVariant({ colorHex: '#123456' })]}
        selectedVariantId="var-1"
        onSelect={vi.fn()}
      />,
    )
    const swatch = container.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(swatch).toBeTruthy()
    expect(swatch.style.backgroundColor).toBeTruthy()
  })

  it('omits the swatch when colorHex is null', () => {
    const { container } = render(
      <VariantSelector
        variants={[makeVariant({ colorHex: null })]}
        selectedVariantId="var-1"
        onSelect={vi.fn()}
      />,
    )
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull()
  })

  it('applies an extra className to the root', () => {
    const { container } = render(
      <VariantSelector
        variants={[makeVariant()]}
        selectedVariantId="var-1"
        onSelect={vi.fn()}
        className="extra-class"
      />,
    )
    expect((container.firstChild as HTMLElement).className).toContain('extra-class')
  })
})
