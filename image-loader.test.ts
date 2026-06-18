import { describe, it, expect } from 'vitest'
import imageLoader from './image-loader'

describe('imageLoader', () => {
  it('rewrites a picsum URL to the requested display width (square)', () => {
    const src = 'https://picsum.photos/seed/abc/800/800'
    expect(imageLoader({ src, width: 256 })).toBe('https://picsum.photos/seed/abc/256/256')
  })

  it('rewrites a picsum URL at another width', () => {
    const src = 'https://picsum.photos/seed/xyz/800/800'
    expect(imageLoader({ src, width: 384 })).toBe('https://picsum.photos/seed/xyz/384/384')
  })

  it('passes through R2 /cdn/ URLs unchanged', () => {
    const src = 'https://shopflare-worker.workers.dev/cdn/landing/hero.avif'
    expect(imageLoader({ src, width: 800 })).toBe(src)
  })

  it('passes through data: URLs unchanged', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo='
    expect(imageLoader({ src, width: 400 })).toBe(src)
  })

  it('passes through a picsum URL that lacks trailing dimension segments unchanged', () => {
    // URL without /<w>/<h> — not a resizable picsum seed URL
    const src = 'https://picsum.photos/seed/abc'
    expect(imageLoader({ src, width: 256 })).toBe(src)
  })

  it('ignores quality param (not used in loader logic)', () => {
    const src = 'https://picsum.photos/seed/test/400/400'
    expect(imageLoader({ src, width: 128, quality: 75 })).toBe(
      'https://picsum.photos/seed/test/128/128',
    )
  })
})
