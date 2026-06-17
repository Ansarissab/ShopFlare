import { describe, it, expect } from 'vitest'
import { sanitizeHtml, parseFaq, stripHtml } from '@/lib/html'

describe('sanitizeHtml', () => {
  it('passes through safe block content', () => {
    const out = sanitizeHtml('<p>Hello <strong>world</strong></p>')
    expect(out).toContain('<p>')
    expect(out).toContain('<strong>')
  })

  it('strips script tags and their body', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('alert(1)')
    expect(out).toContain('<p>ok</p>')
  })

  it('strips event handlers (onerror)', () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)">')
    expect(out).not.toContain('onerror')
  })

  it('strips event handlers (onclick)', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">click</p>')
    expect(out).not.toContain('onclick')
  })

  it('strips <style> tags and their body', () => {
    const out = sanitizeHtml('<style>body{color:red}</style><p>text</p>')
    expect(out).not.toContain('<style>')
    expect(out).not.toContain('body{color:red}')
  })

  it('strips <iframe> tags', () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe>')
    expect(out).not.toContain('<iframe')
    expect(out).not.toContain('evil.com')
  })

  it('strips <object> tags', () => {
    const out = sanitizeHtml('<object data="evil.swf"></object>')
    expect(out).not.toContain('<object')
  })

  it('strips <embed> tags', () => {
    const out = sanitizeHtml('<embed src="evil.swf">')
    expect(out).not.toContain('<embed')
  })

  it('blocks javascript: URIs on href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>')
    expect(out).not.toContain('javascript:')
  })

  it('blocks data: URIs on href', () => {
    const out = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')
    expect(out).not.toContain('data:')
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

  it('allows img with https src and alt', () => {
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

describe('parseFaq', () => {
  it('returns empty array for empty string', () => {
    expect(parseFaq('')).toEqual([])
  })

  it('returns empty array when no h3/h4 headings', () => {
    expect(parseFaq('<p>Just a paragraph</p>')).toEqual([])
  })

  it('parses a single h3 question + paragraph answer', () => {
    const html = '<h3>What is your return policy?</h3><p>We accept returns within 30 days.</p>'
    const items = parseFaq(html)
    expect(items).toHaveLength(1)
    expect(items[0].question).toBe('What is your return policy?')
    expect(items[0].answer).toContain('We accept returns within 30 days.')
  })

  it('parses a single h4 question + paragraph answer', () => {
    const html = '<h4>Do you ship internationally?</h4><p>Yes, we ship worldwide.</p>'
    const items = parseFaq(html)
    expect(items).toHaveLength(1)
    expect(items[0].question).toBe('Do you ship internationally?')
  })

  it('parses multiple Q&A pairs', () => {
    const html = [
      '<h3>Question one?</h3><p>Answer one.</p>',
      '<h3>Question two?</h3><p>Answer two.</p>',
      '<h4>Question three?</h4><p>Answer three.</p>',
    ].join('')
    const items = parseFaq(html)
    expect(items).toHaveLength(3)
    expect(items[0].question).toBe('Question one?')
    expect(items[1].question).toBe('Question two?')
    expect(items[2].question).toBe('Question three?')
  })

  it('strips inline HTML from question text', () => {
    const html = '<h3><strong>Bold question?</strong></h3><p>Answer.</p>'
    const items = parseFaq(html)
    expect(items[0].question).toBe('Bold question?')
  })

  it('strips HTML tags from answer text', () => {
    const html = '<h3>Q?</h3><p>Answer with <strong>bold</strong> and <a href="#">link</a>.</p>'
    const items = parseFaq(html)
    expect(items[0].answer).not.toContain('<strong>')
    expect(items[0].answer).not.toContain('<a')
    expect(items[0].answer).toContain('Answer with')
    expect(items[0].answer).toContain('bold')
  })

  it('skips pairs where answer is empty', () => {
    const html = '<h3>Question with no answer?</h3><h3>Question with answer?</h3><p>Has answer.</p>'
    const items = parseFaq(html)
    expect(items).toHaveLength(1)
    expect(items[0].question).toBe('Question with answer?')
  })

  it('handles content before first heading gracefully', () => {
    const html = '<p>Intro text</p><h3>Q?</h3><p>A.</p>'
    const items = parseFaq(html)
    expect(items).toHaveLength(1)
    expect(items[0].question).toBe('Q?')
  })
})

describe('stripHtml', () => {
  it('strips basic HTML tags', () => {
    expect(stripHtml('<b>hello</b>')).toBe('hello')
  })

  it('strips nested tags', () => {
    expect(stripHtml('<p><strong>bold</strong> text</p>')).toBe('bold text')
  })

  it('collapses multiple whitespace to single space', () => {
    expect(stripHtml('<p>foo</p>   <p>bar</p>')).toBe('foo bar')
  })

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('')
  })

  it('passes through string with no tags', () => {
    expect(stripHtml('plain text here')).toBe('plain text here')
  })

  it('handles tags-only input (no text content)', () => {
    expect(stripHtml('<br><hr>')).toBe('')
  })

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  <p>hello</p>  ')).toBe('hello')
  })
})
