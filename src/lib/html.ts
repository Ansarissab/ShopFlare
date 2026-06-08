import DOMPurify from 'isomorphic-dompurify'

// Allowlist mirrors Trix output: block elements, inline formatting, links, images.
// Strips scripts, event handlers, <style>, data-URIs.
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'p', 'br', 'strong', 'em',
  'ul', 'ol', 'li', 'a', 'blockquote',
  'img', 'figure', 'figcaption',
  'pre', 'code',
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
