// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FaqSection } from './FaqSection'
import type { FaqItem } from '@/lib/seo/jsonld'

afterEach(() => {
  cleanup()
})

const items: FaqItem[] = [
  { question: 'What is your return policy?', answer: 'Returns accepted within 30 days.' },
  { question: 'Do you ship internationally?', answer: 'Yes, worldwide shipping available.' },
]

describe('FaqSection', () => {
  it('renders nothing when items array is empty', () => {
    const { container } = render(<FaqSection items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the FAQ heading', () => {
    render(<FaqSection items={items} />)
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy()
  })

  it('renders each question text', () => {
    render(<FaqSection items={items} />)
    expect(screen.getByText('What is your return policy?')).toBeTruthy()
    expect(screen.getByText('Do you ship internationally?')).toBeTruthy()
  })

  it('renders each answer text', () => {
    render(<FaqSection items={items} />)
    expect(screen.getByText('Returns accepted within 30 days.')).toBeTruthy()
    expect(screen.getByText('Yes, worldwide shipping available.')).toBeTruthy()
  })
})
