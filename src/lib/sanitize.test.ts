import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/lib/sanitize'

describe('sanitizeHtml — allowlist XSS safety', () => {
  // Allowed tags pass through
  it('allows all permitted block/inline tags', () => {
    const input =
      '<h1>H1</h1><h2>H2</h2><h3>H3</h3><p>para</p><br>' +
      '<strong>bold</strong><em>italic</em><ul><li>item</li></ul>' +
      '<ol><li>1</li></ol><blockquote>bq</blockquote>' +
      '<pre><code>code</code></pre>' +
      '<figure><figcaption>cap</figcaption></figure>'
    const out = sanitizeHtml(input)
    for (const tag of [
      'h1',
      'h2',
      'h3',
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'figure',
      'figcaption',
    ]) {
      expect(out, `expected <${tag}> to be present`).toContain(`<${tag}`)
    }
  })

  // Disallowed tags stripped
  it('strips <script> tag and its body content', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('alert(1)')
    expect(out).toContain('<p>ok</p>')
  })

  it('strips <style> tag and its body content', () => {
    const out = sanitizeHtml('<style>body{color:red}</style><p>text</p>')
    expect(out).not.toContain('<style>')
    expect(out).not.toContain('body{color:red}')
    expect(out).toContain('<p>text</p>')
  })

  it('strips <iframe> tag', () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe><p>keep</p>')
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('evil.com')
  })

  it('strips <object> tag', () => {
    const out = sanitizeHtml('<object data="evil.swf"><param name="x" value="y"></object>')
    expect(out).not.toContain('<object')
    expect(out).not.toContain('evil.swf')
  })

  it('strips <embed> tag', () => {
    const out = sanitizeHtml('<embed src="evil.swf"><p>keep</p>')
    expect(out).not.toContain('<embed')
    expect(out).not.toContain('evil.swf')
  })

  it('strips <form> tag', () => {
    const out = sanitizeHtml('<form action="https://phish.com"><p>keep</p></form>')
    expect(out).not.toContain('<form')
  })

  // Event handler attributes stripped
  it('strips onerror event handler', () => {
    const out = sanitizeHtml('<img src="x.jpg" onerror="alert(1)" alt="x">')
    expect(out).not.toContain('onerror')
    expect(out).toContain('<img')
  })

  it('strips onclick event handler', () => {
    const out = sanitizeHtml('<p onclick="evil()">text</p>')
    expect(out).not.toContain('onclick')
    expect(out).toContain('<p>')
  })

  it('strips onload event handler', () => {
    const out = sanitizeHtml('<body onload="evil()"><p>x</p></body>')
    expect(out).not.toContain('onload')
  })

  // URI blocking
  it('blocks javascript: URI on href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('blocks data: URI on href (data: HTML injection)', () => {
    const out = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')
    expect(out).not.toContain('data:')
  })

  it('blocks data: URI on img src', () => {
    const out = sanitizeHtml('<img src="data:image/png;base64,abc" alt="x">')
    expect(out).not.toContain('data:')
  })

  // Anchor safety enforcement
  it('forces rel="nofollow noopener" on anchors', () => {
    const out = sanitizeHtml('<a href="https://example.com">link</a>')
    expect(out).toContain('rel="nofollow noopener"')
  })

  it('forces target="_blank" on anchors', () => {
    const out = sanitizeHtml('<a href="https://example.com">link</a>')
    expect(out).toContain('target="_blank"')
  })

  it('replaces an existing unsafe rel attribute', () => {
    const out = sanitizeHtml('<a href="https://x.com" rel="opener">go</a>')
    expect(out).toContain('rel="nofollow noopener"')
    expect(out).not.toContain('rel="opener"')
  })

  it('allows img with https src and alt', () => {
    const out = sanitizeHtml('<img src="https://cdn.example.com/img.jpg" alt="a cat">')
    expect(out).toContain('<img')
    expect(out).toContain('alt="a cat"')
    expect(out).toContain('src="https://cdn.example.com/img.jpg"')
  })

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('handles plain text (no tags)', () => {
    const out = sanitizeHtml('hello world')
    expect(out).toBe('hello world')
  })
})
