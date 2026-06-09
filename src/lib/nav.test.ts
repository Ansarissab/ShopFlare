import { describe, it, expect } from 'vitest'
import { catalogHref } from '@/lib/nav'

describe('catalogHref', () => {
  it('returns / when landing is disabled', () => {
    expect(catalogHref(false)).toBe('/')
  })

  it('returns /shop when landing is enabled', () => {
    expect(catalogHref(true)).toBe('/shop')
  })

  it('returns / when landing is undefined (flag not loaded)', () => {
    expect(catalogHref(undefined)).toBe('/')
  })

  it('returns / when called with no argument', () => {
    expect(catalogHref()).toBe('/')
  })
})
