import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/lib/html'

describe('sanitizeHtml', () => {
  it('passes through safe block content', () => {
    const out = sanitizeHtml('<p>Hello <strong>world</strong></p>')
    expect(out).toContain('<p>')
    expect(out).toContain('<strong>')
  })

  it('strips script tags', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('<p>ok</p>')
  })

  it('strips event handlers', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">click</p>')
    expect(out).not.toContain('onclick')
  })

  it('strips <style> tags', () => {
    const out = sanitizeHtml('<style>body{color:red}</style><p>text</p>')
    expect(out).not.toContain('<style>')
  })

  it('forces rel="nofollow noopener" on links', () => {
    const out = sanitizeHtml('<a href="https://example.com">link</a>')
    expect(out).toContain('rel="nofollow noopener"')
  })

  it('forces target="_blank" on links', () => {
    const out = sanitizeHtml('<a href="https://example.com">link</a>')
    expect(out).toContain('target="_blank"')
  })

  it('replaces existing unsafe rel on links', () => {
    const out = sanitizeHtml('<a href="x" rel="opener">link</a>')
    expect(out).toContain('rel="nofollow noopener"')
    expect(out).not.toContain('rel="opener"')
  })

  it('allows img with src and alt', () => {
    const out = sanitizeHtml('<img src="https://example.com/img.jpg" alt="test">')
    expect(out).toContain('<img')
    expect(out).toContain('alt="test"')
  })

  it('strips img with data-URI src', () => {
    const out = sanitizeHtml('<img src="data:image/png;base64,abc">')
    expect(out).not.toContain('data:')
  })

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})
