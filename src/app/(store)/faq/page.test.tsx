// @vitest-environment jsdom
/**
 * Unit tests for the FAQ store page (Phase 30).
 * Tests notFound() gating + JSON-LD emission via mocked fetchFromWorker.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { en } from '@/lib/i18n/en'
import type { StoreConfig } from '@/lib/types/common'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

let mockConfig: Partial<StoreConfig> | null = null

vi.mock('@/lib/server/fetchFromWorker', () => ({
  fetchFromWorker: () => Promise.resolve(mockConfig),
}))

vi.mock('@/lib/i18n/server', () => ({
  getT: () => Promise.resolve(en),
}))

vi.mock('@/lib/seo/metadata', () => ({
  buildPageMetadata: () => ({}),
}))

// Render accordion panels always mounted so text is queryable in jsdom.
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: React.ReactNode; value: unknown }) => (
    <div>{children}</div>
  ),
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AccordionContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/shared/RenderHtml', async () => {
  const { createElement } = await import('react')
  return {
    RenderHtml: ({ html }: { html: string }) =>
      createElement('div', { dangerouslySetInnerHTML: { __html: html } }),
  }
})

// FaqSection is an async server component — mock it so render() doesn't choke on it.
vi.mock('@/components/store/FaqSection', async () => {
  const { createElement } = await import('react')
  return {
    FaqSection: ({ items }: { items: Array<{ question: string; answer: string }> }) =>
      createElement(
        'div',
        { 'data-testid': 'faq-section' },
        items.map((item, i) =>
          createElement(
            'div',
            { key: i },
            createElement('span', null, item.question),
            createElement('span', null, item.answer),
          ),
        ),
      ),
  }
})

// Capture emitted JSON-LD payloads for assertion
let capturedJsonLd: Record<string, unknown> | null = null

vi.mock('@/components/shared/JsonLd', async () => {
  const { createElement } = await import('react')
  return {
    JsonLd: ({ data }: { data: Record<string, unknown> }) => {
      capturedJsonLd = data
      return createElement('div', { 'data-testid': 'json-ld' })
    },
  }
})

// ── helpers ────────────────────────────────────────────────────────────────────

async function renderFaqPage() {
  // Import page after mocks are set up. Because vi.mock hoists, the mocks are
  // always active — we import once and the cached module uses the live
  // mockConfig variable each time.
  const { default: FaqPage } = await import('./page')
  const jsx = await FaqPage()
  render(jsx as React.ReactElement)
}

// ── setup / teardown ───────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockConfig = null
  capturedJsonLd = null
})

// ── tests ──────────────────────────────────────────────────────────────────────

describe('FaqPage', () => {
  it('calls notFound() when faqEnabled is false', async () => {
    mockConfig = { faqEnabled: false, faqItems: [{ question: 'Q', answer: 'A' }] }
    await expect(renderFaqPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('calls notFound() when faqEnabled true but faqItems is empty', async () => {
    mockConfig = { faqEnabled: true, faqItems: [] }
    await expect(renderFaqPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('calls notFound() when faqEnabled true but faqItems is undefined', async () => {
    mockConfig = { faqEnabled: true }
    await expect(renderFaqPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('calls notFound() when config is null', async () => {
    mockConfig = null
    await expect(renderFaqPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })

  it('renders FaqSection when faqEnabled and items are non-empty', async () => {
    mockConfig = {
      faqEnabled: true,
      faqItems: [
        { question: 'What is your return policy?', answer: 'Returns accepted within 30 days.' },
        { question: 'Do you ship internationally?', answer: 'Yes, worldwide shipping.' },
      ],
    }
    await renderFaqPage()
    expect(screen.getByText('What is your return policy?')).toBeTruthy()
    expect(screen.getByText('Do you ship internationally?')).toBeTruthy()
  })

  it('emits FAQPage JSON-LD with correct @type and @context', async () => {
    mockConfig = {
      faqEnabled: true,
      faqItems: [{ question: 'How do I order?', answer: 'Via our website.' }],
    }
    await renderFaqPage()
    expect(capturedJsonLd).not.toBeNull()
    expect(capturedJsonLd!['@type']).toBe('FAQPage')
    expect(capturedJsonLd!['@context']).toBe('https://schema.org')
  })

  it('JSON-LD answers use stripHtml — no HTML tags in emitted answers', async () => {
    mockConfig = {
      faqEnabled: true,
      faqItems: [
        {
          question: 'Q?',
          answer: '<p>Answer with <strong>bold</strong> and <a href="#">link</a>.</p>',
        },
      ],
    }
    await renderFaqPage()
    expect(capturedJsonLd).not.toBeNull()
    const mainEntity = capturedJsonLd!.mainEntity as Array<{
      '@type': string
      name: string
      acceptedAnswer: { text: string }
    }>
    expect(mainEntity).toHaveLength(1)
    const answerText = mainEntity[0].acceptedAnswer.text
    expect(answerText).not.toContain('<')
    expect(answerText).not.toContain('>')
    expect(answerText).toContain('Answer with')
    expect(answerText).toContain('bold')
  })

  it('JSON-LD question names match the raw question strings', async () => {
    mockConfig = {
      faqEnabled: true,
      faqItems: [
        { question: 'First question?', answer: 'First answer.' },
        { question: 'Second question?', answer: 'Second answer.' },
      ],
    }
    await renderFaqPage()
    expect(capturedJsonLd).not.toBeNull()
    const mainEntity = capturedJsonLd!.mainEntity as Array<{ name: string }>
    expect(mainEntity[0].name).toBe('First question?')
    expect(mainEntity[1].name).toBe('Second question?')
  })
})
