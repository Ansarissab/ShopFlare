// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SearchBar } from './SearchBar'
import { en } from '@/lib/i18n/en'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'

// Only fake the debounce timers — leave React's scheduler untouched.
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SearchBar', () => {
  it('debounces — onChange fires once after the delay, not per keystroke', () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: 's' } })
    fireEvent.change(input, { target: { value: 'sh' } })
    fireEvent.change(input, { target: { value: 'shirt' } })

    // Nothing yet — still within the debounce window.
    expect(onChange).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('shirt')
  })

  it('does not emit before the debounce delay elapses', () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hat' } })

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1))
    expect(onChange).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onChange).toHaveBeenCalledWith('hat')
  })

  it('clear button empties the input and emits an empty query', () => {
    const onChange = vi.fn()
    render(<SearchBar value="hat" onChange={onChange} />)
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('hat')

    fireEvent.click(screen.getByLabelText(en.store.searchClearHint))
    expect(input.value).toBe('')

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('syncs an externally reset value into the input (URL navigation)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SearchBar value="" onChange={onChange} />)
    const input = screen.getByRole('searchbox') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'typed' } })
    expect(input.value).toBe('typed')

    // Parent pushes a new value (e.g. shareable ?q= link) — input must follow.
    rerender(<SearchBar value="reset" onChange={onChange} />)
    expect(input.value).toBe('reset')
  })
})
