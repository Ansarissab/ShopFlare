import type { FaqItem } from '@/lib/seo/jsonld'
import { parseFaqHtml } from '@/lib/faq'
import { sanitizeHtml as sanitize } from '@/lib/sanitize'

// Parses Trix HTML into FAQ Q&A pairs.
// Delegates to the pure regex parser in @/lib/faq (no DOM deps — safe in workerd).
// Convention: <h3> or <h4> = question; the following block element(s) = answer.
// The visible FAQ rendered on the page must match this output exactly (spam guard).
export function parseFaq(html: string): FaqItem[] {
  return parseFaqHtml(html)
}

/** Strip all HTML tags and collapse whitespace — use for plain-text contexts (e.g. JSON-LD). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export { sanitize as sanitizeHtml }
