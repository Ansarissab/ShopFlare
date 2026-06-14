// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { en } from '@/lib/i18n/en'
import type { FaqItem } from '@/lib/seo/jsonld'

vi.mock('@/lib/i18n/server', () => ({
  getT: () => Promise.resolve(en),
}))

// Render accordion panels always mounted so text content is queryable in jsdom.
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: React.ReactNode; value: unknown }) => (
    <div>{children}</div>
  ),
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AccordionContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

afterEach(() => {
  cleanup()
})

const items: FaqItem[] = [
  { question: 'What is your return policy?', answer: 'Returns accepted within 30 days.' },
  { question: 'Do you ship internationally?', answer: 'Yes, worldwide shipping available.' },
]

describe('FaqSection', () => {
  it('renders nothing when items array is empty', async () => {
    const { FaqSection } = await import('./FaqSection')
    const { container } = render(await FaqSection({ items: [] }))
    expect(container.firstChild).toBeNull()
  })

  it('renders the FAQ heading', async () => {
    const { FaqSection } = await import('./FaqSection')
    render(await FaqSection({ items }))
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy()
  })

  it('uses custom heading when provided', async () => {
    const { FaqSection } = await import('./FaqSection')
    render(await FaqSection({ items, heading: 'Product FAQs' }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Product FAQs')
  })

  it('renders each question text', async () => {
    const { FaqSection } = await import('./FaqSection')
    render(await FaqSection({ items }))
    expect(screen.getByText('What is your return policy?')).toBeTruthy()
    expect(screen.getByText('Do you ship internationally?')).toBeTruthy()
  })

  it('renders each answer via RenderHtml', async () => {
    const { FaqSection } = await import('./FaqSection')
    render(await FaqSection({ items }))
    expect(screen.getByText('Returns accepted within 30 days.')).toBeTruthy()
    expect(screen.getByText('Yes, worldwide shipping available.')).toBeTruthy()
  })
})
