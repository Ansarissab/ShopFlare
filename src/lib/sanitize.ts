// Edge-native allowlist HTML sanitizer using js-xss.
// Safe in all runtimes: Next.js SSR, Cloudflare Workers (workerd), Node.js.
// No DOM globals required — pure-JS parser.
import { FilterXSS, type IFilterXSSOptions, safeAttrValue as defaultSafeAttrValue } from 'xss'

// Allowlist mirrors Trix output: block elements, inline formatting, links, images.
// Tags not in this list are stripped entirely (stripIgnoreTag: true).
// script/style bodies are removed, not just the tags (stripIgnoreTagBody).
const WHITE_LIST: IFilterXSSOptions['allowList'] = {
  h1: [],
  h2: [],
  h3: [],
  p: [],
  br: [],
  strong: [],
  em: [],
  ul: [],
  ol: [],
  li: [],
  a: ['href', 'rel', 'target'],
  blockquote: [],
  img: ['src', 'alt'],
  figure: [],
  figcaption: [],
  pre: [],
  code: [],
}

// Block javascript: and ALL data: URIs on href/src.
// xss default safeAttrValue allows data:image/ — we must override that.
function blockDangerousUris(
  tag: string,
  name: string,
  value: string,
  cssFilter: Parameters<typeof defaultSafeAttrValue>[3],
): string {
  if (name === 'href' || name === 'src') {
    const v = value.trim().toLowerCase()
    if (v.startsWith('javascript:') || v.startsWith('data:')) {
      return ''
    }
  }
  return defaultSafeAttrValue(tag, name, value, cssFilter)
}

const xssFilter = new FilterXSS({
  allowList: WHITE_LIST,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  safeAttrValue: blockDangerousUris,
})

// Force every anchor to open externally with safe rel. Applied post-sanitize
// via regex so no stateful hook is needed.
function enforceAnchorSafety(html: string): string {
  return html
    .replace(/<a(\s[^>]*)?\s+rel="[^"]*"/gi, '<a$1')
    .replace(/<a(\s[^>]*)?\s+target="[^"]*"/gi, '<a$1')
    .replace(/<a(\s)/gi, '<a rel="nofollow noopener" target="_blank"$1')
    .replace(/<a>/gi, '<a rel="nofollow noopener" target="_blank">')
}

/** Allowlist-based XSS sanitizer. Strips all tags not in the allowlist,
 *  removes script/style bodies, blocks javascript:/data: URIs, and forces
 *  anchor rel="nofollow noopener" target="_blank". */
export function sanitizeHtml(dirty: string): string {
  const sanitized = xssFilter.process(dirty)
  return enforceAnchorSafety(sanitized)
}
