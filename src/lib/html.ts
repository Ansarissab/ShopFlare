import DOMPurify from 'isomorphic-dompurify'
import type { FaqItem } from '@/lib/seo/jsonld'

// Allowlist mirrors Trix output: block elements, inline formatting, links, images.
// Strips scripts, event handlers, <style>, data-URIs.
const ALLOWED_TAGS = [
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
  'a',
  'blockquote',
  'img',
  'figure',
  'figcaption',
  'pre',
  'code',
]

const ALLOWED_ATTR = ['href', 'rel', 'target', 'src', 'alt']

// Force every anchor to open externally with safe rel. Applied post-sanitize
// via regex so no global DOMPurify hook state is needed.
function enforceAnchorSafety(html: string): string {
  return html
    .replace(/<a(\s[^>]*)?\s+rel="[^"]*"/gi, '<a$1')
    .replace(/<a(\s[^>]*)?\s+target="[^"]*"/gi, '<a$1')
    .replace(/<a(\s)/gi, '<a rel="nofollow noopener" target="_blank"$1')
    .replace(/<a>/gi, '<a rel="nofollow noopener" target="_blank">')
}

// Parses Trix HTML into FAQ Q&A pairs.
// Convention: <h3> or <h4> = question; the following block element(s) = answer.
// The visible FAQ rendered on the page must match this output exactly (spam guard).
export function parseFaq(html: string): FaqItem[] {
  const items: FaqItem[] = []
  // Split on every h3/h4 opening tag — first segment before any heading is discarded.
  const segments = html.split(/(?=<h[34][\s>])/i)
  for (const seg of segments) {
    const qMatch = seg.match(/^<h[34][^>]*>([\s\S]*?)<\/h[34]>/i)
    if (!qMatch) continue
    const question = qMatch[1].replace(/<[^>]+>/g, '').trim()
    // Answer = everything after the closing heading tag, stripped of HTML.
    const afterHeading = seg.slice(qMatch[0].length)
    const answer = afterHeading
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (question && answer) items.push({ question, answer })
  }
  return items
}

export function sanitizeHtml(dirty: string): string {
  const sanitized = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORCE_BODY: false,
  }) as string
  // Strip data: URIs (base64 images) and enforce anchor safety.
  const clean = sanitized.replace(/\ssrc="data:[^"]*"/gi, '')
  return enforceAnchorSafety(clean)
}
