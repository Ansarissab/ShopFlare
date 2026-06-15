import { describe, it, expect } from 'vitest'
import { sanitizeHeadTags } from './headTags'

// Security-critical: sanitizeHeadTags is the render-time gate for
// admin-supplied customHeadTags injected into layout.tsx <head>.

describe('sanitizeHeadTags', () => {
  // ─── Basic keep / drop ──────────────────────────────────────────────────────

  it('returns empty string for empty input', () => {
    expect(sanitizeHeadTags('')).toBe('')
  })

  it('keeps a valid <meta name content> tag', () => {
    const input = '<meta name="description" content="My shop">'
    const result = sanitizeHeadTags(input)
    expect(result).toContain('<meta')
    expect(result).toContain('name="description"')
    expect(result).toContain('content="My shop"')
  })

  it('keeps a self-closing <meta> tag', () => {
    const result = sanitizeHeadTags('<meta name="viewport" content="width=device-width" />')
    expect(result).toContain('<meta')
    expect(result).toContain('name="viewport"')
  })

  it('keeps a valid <link rel href> tag', () => {
    const input = '<link rel="canonical" href="https://example.com/">'
    const result = sanitizeHeadTags(input)
    expect(result).toContain('<link')
    expect(result).toContain('rel="canonical"')
    expect(result).toContain('href="https://example.com/"')
  })

  it('keeps a <link> with hreflang', () => {
    const input = '<link rel="alternate" hreflang="fr" href="https://example.com/fr/">'
    const result = sanitizeHeadTags(input)
    expect(result).toContain('hreflang="fr"')
  })

  // ─── Script / dangerous tags dropped ───────────────────────────────────────

  it('strips <script> tags', () => {
    const result = sanitizeHeadTags('<script>alert(1)</script>')
    expect(result).not.toContain('script')
    expect(result).not.toContain('alert')
  })

  it('strips <script src=...>', () => {
    const result = sanitizeHeadTags('<script src="https://evil.com/x.js"></script>')
    expect(result).not.toContain('script')
  })

  it('strips <style> tags', () => {
    const result = sanitizeHeadTags('<style>body{color:red}</style>')
    expect(result).not.toContain('style')
  })

  it('strips <iframe> tags', () => {
    const result = sanitizeHeadTags('<iframe src="https://evil.com"></iframe>')
    expect(result).not.toContain('iframe')
  })

  it('strips plain text nodes', () => {
    const result = sanitizeHeadTags('Hello world <meta name="a" content="b">')
    expect(result).not.toContain('Hello')
    expect(result).toContain('<meta')
  })

  it('strips HTML comments', () => {
    const result = sanitizeHeadTags('<!-- comment --><meta name="x" content="y">')
    expect(result).not.toContain('comment')
    expect(result).toContain('<meta')
  })

  // ─── Event handler attributes stripped ─────────────────────────────────────

  it('drops on*= event handlers from a meta-like tag', () => {
    // A tag that looks like meta but has an event handler — drop the whole tag.
    const result = sanitizeHeadTags('<meta name="x" onerror="alert(1)" content="y">')
    // The entire tag should be dropped because of the event handler
    expect(result).not.toContain('onerror')
  })

  it('drops onload= event handler tags', () => {
    const result = sanitizeHeadTags('<link rel="stylesheet" onload="evil()" href="/a.css">')
    expect(result).not.toContain('onload')
  })

  // ─── External stylesheet / code injection blocked ───────────────────────────

  it('drops <link rel="stylesheet"> entirely (external CSS injection)', () => {
    const result = sanitizeHeadTags('<link rel="stylesheet" href="https://evil.com/x.css">')
    expect(result).not.toContain('<link')
    expect(result).not.toContain('evil.com')
  })

  it('drops <link rel="import"> entirely', () => {
    const result = sanitizeHeadTags('<link rel="import" href="https://evil.com/x.html">')
    expect(result).not.toContain('<link')
    expect(result).not.toContain('evil.com')
  })

  it('keeps <link rel="canonical"> (not in deny set)', () => {
    const result = sanitizeHeadTags('<link rel="canonical" href="https://example.com/">')
    expect(result).toContain('rel="canonical"')
    expect(result).toContain('href="https://example.com/"')
  })

  it('keeps <link rel="preconnect"> (not in deny set)', () => {
    const result = sanitizeHeadTags('<link rel="preconnect" href="https://fonts.googleapis.com">')
    expect(result).toContain('rel="preconnect"')
  })

  // ─── javascript:/vbscript: URI schemes stripped ─────────────────────────────

  it('drops an attribute whose value is a javascript: URI', () => {
    // href="javascript:..." on a link — attribute should be stripped
    const result = sanitizeHeadTags('<link rel="canonical" href="javascript:alert(1)">')
    expect(result).not.toContain('javascript:')
  })

  it('drops an attribute whose value is a vbscript: URI', () => {
    const result = sanitizeHeadTags('<link rel="canonical" href="vbscript:msgbox(1)">')
    expect(result).not.toContain('vbscript:')
  })

  it('drops an attribute whose value is a data: URI', () => {
    const result = sanitizeHeadTags('<link rel="icon" href="data:image/png;base64,abc">')
    expect(result).not.toContain('data:')
  })

  // ─── Disallowed attributes stripped ────────────────────────────────────────

  it('strips disallowed attributes (id, class, style, data-x) from kept tags', () => {
    const result = sanitizeHeadTags(
      '<meta name="desc" content="ok" id="bad" class="bad" style="bad" data-x="bad">',
    )
    expect(result).not.toContain('id=')
    expect(result).not.toContain('class=')
    expect(result).not.toContain('style=')
    expect(result).not.toContain('data-x=')
    // name + content are safe and should be kept
    expect(result).toContain('name="desc"')
    expect(result).toContain('content="ok"')
  })

  // ─── Attribute-injection breakout ──────────────────────────────────────────

  it('escapes a single-quoted value containing a double-quote so it cannot break out', () => {
    // Without output escaping, this re-quotes to content="y"href=javascript:..."
    // injecting a second attribute. Escaping the embedded quote (→ &quot;) keeps
    // the whole string inert inside one content value — javascript: survives only
    // as harmless text, never as a real attribute.
    const result = sanitizeHeadTags(`<meta name="x" content='y"href=javascript:alert(1)'>`)
    expect(result).toContain('&quot;')
    // No attribute breakout: nothing after the content value's closing quote
    // except the tag end (no injected `key=` attribute).
    expect(result).not.toMatch(/content="[^"]*"\s*[a-z-]+=/i)
  })

  it('entity-encodes & < " inside a kept attribute value', () => {
    // A literal `>` in source would truncate the tag (invalid HTML anyway), so
    // test the escapable chars that can legally appear inside an attribute.
    const result = sanitizeHeadTags(`<meta name="x" content='a&b<c"d'>`)
    expect(result).toContain('&amp;')
    expect(result).toContain('&lt;')
    expect(result).toContain('&quot;')
    expect(result).not.toMatch(/content="a&b<c"d"/)
  })

  // ─── Multiple tags ──────────────────────────────────────────────────────────

  it('keeps multiple valid tags and drops bad ones', () => {
    const input = [
      '<meta name="description" content="Shop">',
      '<script>evil()</script>',
      '<link rel="canonical" href="https://example.com/">',
    ].join('\n')
    const result = sanitizeHeadTags(input)
    expect(result).toContain('name="description"')
    expect(result).toContain('rel="canonical"')
    // Note: 'description' contains the substring 'script', so assert on the tag.
    expect(result).not.toContain('<script')
    expect(result).not.toContain('evil')
  })

  // ─── Idempotency ───────────────────────────────────────────────────────────

  it('is idempotent — sanitize(sanitize(x)) === sanitize(x)', () => {
    const input = [
      '<meta name="description" content="My shop">',
      '<script>alert(1)</script>',
      '<link rel="canonical" href="https://example.com/">',
      '<meta property="og:title" content="Shop" onerror="x">',
    ].join('\n')
    const once = sanitizeHeadTags(input)
    const twice = sanitizeHeadTags(once)
    expect(twice).toBe(once)
  })

  it('is idempotent for a clean input', () => {
    const clean = '<meta name="author" content="ShopFlare">'
    expect(sanitizeHeadTags(sanitizeHeadTags(clean))).toBe(sanitizeHeadTags(clean))
  })

  // ─── Open Graph / property attr ────────────────────────────────────────────

  it('keeps <meta property="og:..."> tags', () => {
    const result = sanitizeHeadTags('<meta property="og:title" content="My Store">')
    expect(result).toContain('property="og:title"')
    expect(result).toContain('content="My Store"')
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it('handles whitespace-only input', () => {
    expect(sanitizeHeadTags('   \n  ')).toBe('')
  })

  it('handles upper-case tag names', () => {
    const result = sanitizeHeadTags('<META NAME="desc" CONTENT="val">')
    expect(result).toContain('<meta')
  })
})
