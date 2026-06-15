// Regex-based head-tag sanitizer — workerd-safe (NO DOM, NO DOMPurify).
//
// Why regex: layout.tsx runs during SSR on the Cloudflare Workers runtime
// (workerd). isomorphic-dompurify requires browser DOM globals (window,
// document) that are NOT available in workerd. This function is therefore
// the render-time gate for admin-supplied customHeadTags.
//
// Strategy: allowlist-only tokenizer over <meta> and <link> matches.
// Everything else (scripts, styles, iframes, text nodes, comments, event
// handlers, dangerous URI schemes) is silently dropped. An allowlist over a
// small, well-defined tag set is safer than a blocklist over an unbounded
// one.
//
// Later agents: call sanitizeHeadTags(config.customHeadTags) in layout.tsx
// and inject the result via dangerouslySetInnerHTML or next/head. The schema
// refine in marketingSchema is an early-feedback gate for the admin form, NOT
// a security guarantee — this function is the real gate.

import { ALLOWED_HEAD_TAG_NAMES, DENY_LINK_REL } from '@/lib/constants'

/** Attributes allowed inside <meta> and <link> tags. */
const SAFE_ATTRIBUTES = new Set([
  'name',
  'property',
  'content',
  'rel',
  'href',
  'hreflang',
  'type',
  'sizes',
  'media',
  'charset',
  'color',
  'scheme',
])

/** URI scheme patterns that must never appear in attribute values. */
const DANGEROUS_SCHEME = /^\s*(javascript|vbscript|data)\s*:/i

/**
 * Escape an attribute value for safe re-quoting in double quotes. Without this,
 * a single-quoted source value containing a `"` would break out of the emitted
 * `name="value"` and inject a new attribute (e.g. an event handler or a
 * javascript: href). Order matters: ampersand first.
 */
function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Tokenize a single tag's attribute string and return only safe attributes.
 * Strips any attribute not in SAFE_ATTRIBUTES and any whose value matches a
 * dangerous URI scheme.
 */
function sanitizeAttributes(attrStr: string): string {
  // Match key="value", key='value', or bare key (no value)
  const attrPattern = /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  const parts: string[] = []
  let m: RegExpExecArray | null

  while ((m = attrPattern.exec(attrStr)) !== null) {
    const name = m[1].toLowerCase()
    // Value is whichever capture group matched (double-quote, single-quote, bare)
    const value = m[2] ?? m[3] ?? m[4] ?? null

    if (!SAFE_ATTRIBUTES.has(name)) continue
    if (value !== null && DANGEROUS_SCHEME.test(value)) continue

    if (value === null) {
      parts.push(name)
    } else {
      // Re-quote with double quotes to normalise output, escaping the value so
      // an embedded quote can't break out into an injected attribute.
      parts.push(`${name}="${escapeAttrValue(value)}"`)
    }
  }

  return parts.length > 0 ? ' ' + parts.join(' ') : ''
}

/**
 * Sanitize admin-supplied custom head tags.
 *
 * Keeps ONLY well-formed `<meta ...>` and `<link ...>` tags.
 * Drops everything else: scripts, styles, iframes, text nodes, comments,
 * on*= handlers, javascript:/vbscript:/data: URIs, and disallowed attributes.
 *
 * The function is idempotent: sanitizeHeadTags(sanitizeHeadTags(x)) === sanitizeHeadTags(x).
 */
export function sanitizeHeadTags(raw: string): string {
  if (!raw) return ''

  const tagNames = ALLOWED_HEAD_TAG_NAMES.join('|')
  // Match opening tags for allowed elements (self-closing or not).
  // Capture group 1 = tag name, group 2 = attribute string.
  const tagPattern = new RegExp(`<(${tagNames})((?:\\s[^>]*)?)\\s*/?>`, 'gi')

  const kept: string[] = []
  let m: RegExpExecArray | null

  while ((m = tagPattern.exec(raw)) !== null) {
    const tag = m[1].toLowerCase()
    const attrStr = m[2] ?? ''

    // Extra guard: skip if the raw attribute string contains an event handler
    if (/\bon[a-z]+\s*=/i.test(attrStr)) continue

    // Block external stylesheet/code injection: drop <link> when rel contains
    // a denied token (stylesheet or import). Checks case-insensitively over
    // space-separated tokens so "stylesheet preload" is also rejected.
    if (tag === 'link') {
      const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i.exec(attrStr)
      if (relMatch) {
        const relValue = (relMatch[1] ?? relMatch[2] ?? relMatch[3] ?? '').toLowerCase()
        const relTokens = relValue.split(/\s+/)
        if (relTokens.some((t) => DENY_LINK_REL.has(t))) continue
      }
    }

    const safeAttrs = sanitizeAttributes(attrStr)
    kept.push(`<${tag}${safeAttrs}>`)
  }

  return kept.join('\n')
}
