// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useListNavigation } from './useListNavigation'

describe('useListNavigation', () => {
  const items = ['a', 'b', 'c'] as const

  it('starts at -1', () => {
    const { result } = renderHook(() => useListNavigation({ items }))
    expect(result.current.activeIndex).toBe(-1)
  })

  it('next from -1 goes to 0', () => {
    const { result } = renderHook(() => useListNavigation({ items }))
    act(() => result.current.next())
    expect(result.current.activeIndex).toBe(0)
  })

  it('next advances index', () => {
    const { result } = renderHook(() => useListNavigation({ items }))
    act(() => result.current.next())
    act(() => result.current.next())
    expect(result.current.activeIndex).toBe(1)
  })

  it('next clamps at length-1', () => {
    const { result } = renderHook(() => useListNavigation({ items }))
    act(() => {
      result.current.next()
      result.current.next()
      result.current.next()
      result.current.next()
    })
    expect(result.current.activeIndex).toBe(2)
  })

  it('prev clamps at 0', () => {
    const { result } = renderHook(() => useListNavigation({ items }))
    act(() => {
      result.current.next()
      result.current.prev()
      result.current.prev()
    })
    expect(result.current.activeIndex).toBe(0)
  })

  it('open calls onOpen with correct item and index', () => {
    const onOpen = vi.fn()
    const { result } = renderHook(() => useListNavigation({ items, onOpen }))
    act(() => {
      result.current.next() // index 0
      result.current.next() // index 1
    })
    act(() => result.current.open())
    expect(onOpen).toHaveBeenCalledWith('b', 1)
  })

  it('open no-ops when activeIndex is -1', () => {
    const onOpen = vi.fn()
    const { result } = renderHook(() => useListNavigation({ items, onOpen }))
    act(() => result.current.open())
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('isActive returns true only for active index', () => {
    const { result } = renderHook(() => useListNavigation({ items }))
    act(() => result.current.next()) // index 0
    expect(result.current.isActive(0)).toBe(true)
    expect(result.current.isActive(1)).toBe(false)
  })

  it('isActive returns false for all indices at start', () => {
    const { result } = renderHook(() => useListNavigation({ items }))
    expect(result.current.isActive(0)).toBe(false)
    expect(result.current.isActive(1)).toBe(false)
    expect(result.current.isActive(2)).toBe(false)
  })

  it('empty array — next/prev/open do not throw', () => {
    const { result } = renderHook(() => useListNavigation({ items: [] as string[] }))
    expect(() => {
      act(() => {
        result.current.next()
        result.current.prev()
        result.current.open()
      })
    }).not.toThrow()
  })

  it('setActiveIndex allows direct index selection', () => {
    const { result } = renderHook(() => useListNavigation({ items }))
    act(() => result.current.setActiveIndex(2))
    expect(result.current.activeIndex).toBe(2)
    expect(result.current.isActive(2)).toBe(true)
  })
})
