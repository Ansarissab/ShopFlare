import { describe, it, expect } from 'vitest'
import { contrastColor } from './utils'

describe('contrastColor', () => {
  it('returns white on dark backgrounds', () => {
    expect(contrastColor('#000000')).toBe('#ffffff')
    expect(contrastColor('#18181b')).toBe('#ffffff')
    expect(contrastColor('#065f46')).toBe('#ffffff')
  })
  it('returns black on light backgrounds', () => {
    expect(contrastColor('#ffffff')).toBe('#000000')
    expect(contrastColor('#fafafa')).toBe('#000000')
    expect(contrastColor('#f3f4f6')).toBe('#000000')
  })
  it('handles mid-tones correctly', () => {
    // #6366f1 luminance ≈ 0.185 (just above threshold) → dark text
    expect(contrastColor('#6366f1')).toBe('#000000')
    expect(contrastColor('#10b981')).toBe('#000000')
  })
})
