// HTML sanitizer for the CF Workers runtime.
// isomorphic-dompurify requires browser DOM globals not available in workerd.
// This regex-based sanitizer covers the main XSS vectors for admin-written
// content stored in D1. Client-side RenderHtml (DOMPurify) is the primary gate.

function enforceAnchorSafety(html: string): string {
  return html
    .replace(/<a(\s[^>]*)?\s+rel="[^"]*"/gi, '<a$1')
    .replace(/<a(\s[^>]*)?\s+target="[^"]*"/gi, '<a$1')
    .replace(/<a(\s)/gi, '<a rel="nofollow noopener" target="_blank"$1')
    .replace(/<a>/gi, '<a rel="nofollow noopener" target="_blank">')
}

export function sanitizeHtml(dirty: string): string {
  let clean = dirty
  // Remove script elements + content
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '')
  // Remove style elements
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Remove event handler attributes (onclick, onerror, onload, etc.)
  clean = clean.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
  // Remove javascript: URIs
  clean = clean.replace(/(href|src|action)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '$1="#"')
  // Remove data: URI images (base64 blobs stored in-column violate the $0 budget rule)
  clean = clean.replace(/\ssrc="data:[^"]*"/gi, '')
  return enforceAnchorSafety(clean)
}
