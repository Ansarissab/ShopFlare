import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/utils/index'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })
  it('strips punctuation', () => {
    expect(slugify("Men's Clothing!")).toBe('men-s-clothing')
  })
  it('collapses multiple separators', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar')
  })
  it('removes leading/trailing hyphens', () => {
    expect(slugify('  -hello- ')).toBe('hello')
  })
  it('strips unicode / non-ASCII', () => {
    expect(slugify('Ñoño café')).toBe('o-o-caf')
  })
  it('truncates at 80 chars', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(80)
  })
  it('returns empty string for blank input', () => {
    expect(slugify('   ')).toBe('')
  })
})
