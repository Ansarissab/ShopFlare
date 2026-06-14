// @vitest-environment jsdom
/**
 * Unit tests for FaqItemsControls admin component (Phase 30).
 * Mirrors AnnouncementControls.test.tsx style.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { FaqItemsControls } from './FaqItemsControls'
import { en } from '@/lib/i18n/en'
import type { FaqItemData } from '@/lib/schemas/config'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n/Provider', () => ({
  useT: () => en,
}))

vi.mock('@/components/shared/RichText', async () => {
  const { createElement } = await import('react')
  return {
    RichText: ({ value, onChange }: { value: string; onChange: (html: string) => void }) =>
      createElement('textarea', {
        'data-testid': 'rich-text',
        value,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
      }),
  }
})

// ── helpers ────────────────────────────────────────────────────────────────────

function makeItems(count: number): FaqItemData[] {
  return Array.from({ length: count }, (_, i) => ({
    question: `Question ${i + 1}`,
    answer: `Answer ${i + 1}`,
  }))
}

function renderControls(value: FaqItemData[], onChange: (items: FaqItemData[]) => void) {
  return render(<FaqItemsControls value={value} onChange={onChange} />)
}

// ── setup / teardown ───────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── tests ──────────────────────────────────────────────────────────────────────

describe('FaqItemsControls', () => {
  it('renders empty state text when value is empty array', () => {
    renderControls([], vi.fn())
    expect(screen.getByText(en.admin.faqEmptyState)).toBeTruthy()
  })

  it('does not render empty state text when value has items', () => {
    renderControls(makeItems(1), vi.fn())
    expect(screen.queryByText(en.admin.faqEmptyState)).toBeNull()
  })

  it('Add button appends a blank row — onChange called with length+1', () => {
    const onChange = vi.fn()
    renderControls(makeItems(2), onChange)
    const addBtn = screen.getByRole('button', { name: en.admin.faqAddItem })
    fireEvent.click(addBtn)
    expect(onChange).toHaveBeenCalledTimes(1)
    const result = onChange.mock.calls[0][0] as FaqItemData[]
    expect(result).toHaveLength(3)
    expect(result[2]).toEqual({ question: '', answer: '' })
  })

  it('Add button is hidden (not rendered) when value already has 50 items', () => {
    renderControls(makeItems(50), vi.fn())
    expect(screen.queryByRole('button', { name: en.admin.faqAddItem })).toBeNull()
  })

  it('Remove button on row N calls onChange with that item removed', () => {
    const onChange = vi.fn()
    const items = makeItems(3)
    renderControls(items, onChange)
    // Remove buttons have aria-label from t.admin.faqRemoveItem
    const removeBtns = screen.getAllByRole('button', { name: en.admin.faqRemoveItem })
    // Click remove on the second item (index 1)
    fireEvent.click(removeBtns[1])
    expect(onChange).toHaveBeenCalledTimes(1)
    const result = onChange.mock.calls[0][0] as FaqItemData[]
    expect(result).toHaveLength(2)
    expect(result[0].question).toBe('Question 1')
    expect(result[1].question).toBe('Question 3')
  })

  it('Move-up button on index 0 is disabled', () => {
    renderControls(makeItems(2), vi.fn())
    const upBtns = screen.getAllByRole('button', { name: en.admin.faqMoveUp })
    expect((upBtns[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('Move-down button on last index is disabled', () => {
    renderControls(makeItems(2), vi.fn())
    const downBtns = screen.getAllByRole('button', { name: en.admin.faqMoveDown })
    expect((downBtns[downBtns.length - 1] as HTMLButtonElement).disabled).toBe(true)
  })

  it('Move-up on index 1 swaps rows 0 and 1 in onChange', () => {
    const onChange = vi.fn()
    const items = makeItems(3)
    renderControls(items, onChange)
    const upBtns = screen.getAllByRole('button', { name: en.admin.faqMoveUp })
    // upBtns[0] is disabled (index 0); upBtns[1] is index 1
    fireEvent.click(upBtns[1])
    expect(onChange).toHaveBeenCalledTimes(1)
    const result = onChange.mock.calls[0][0] as FaqItemData[]
    expect(result[0].question).toBe('Question 2')
    expect(result[1].question).toBe('Question 1')
    expect(result[2].question).toBe('Question 3')
  })

  it('Move-down on index 0 swaps rows 0 and 1 in onChange', () => {
    const onChange = vi.fn()
    const items = makeItems(3)
    renderControls(items, onChange)
    const downBtns = screen.getAllByRole('button', { name: en.admin.faqMoveDown })
    // downBtns[0] is index 0
    fireEvent.click(downBtns[0])
    expect(onChange).toHaveBeenCalledTimes(1)
    const result = onChange.mock.calls[0][0] as FaqItemData[]
    expect(result[0].question).toBe('Question 2')
    expect(result[1].question).toBe('Question 1')
    expect(result[2].question).toBe('Question 3')
  })

  it('Editing the question input calls onChange with updated question', () => {
    const onChange = vi.fn()
    const items = makeItems(2)
    renderControls(items, onChange)
    // Question inputs have id faq-q-{idx}
    // Question inputs have id faq-q-{idx}; rich-text textareas come after
    const firstQuestionInput = document.getElementById('faq-q-0') as HTMLInputElement
    fireEvent.change(firstQuestionInput, { target: { value: 'Updated Question' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    const result = onChange.mock.calls[0][0] as FaqItemData[]
    expect(result[0].question).toBe('Updated Question')
    expect(result[1].question).toBe('Question 2')
  })

  it('Editing the answer (RichText) calls onChange with updated answer', () => {
    const onChange = vi.fn()
    const items = makeItems(2)
    renderControls(items, onChange)
    const richTexts = screen.getAllByTestId('rich-text') as HTMLTextAreaElement[]
    fireEvent.change(richTexts[0], { target: { value: '<p>Updated answer</p>' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    const result = onChange.mock.calls[0][0] as FaqItemData[]
    expect(result[0].answer).toBe('<p>Updated answer</p>')
    expect(result[1].answer).toBe('Answer 2')
  })
})
