// Pure FAQ HTML parser — no DOM deps, no DOMPurify.
// Safe to import in both the Next.js frontend AND the CF Worker (workerd).
//
// Convention: <h3> or <h4> = question; the following block element(s) = answer.
// The visible FAQ rendered on the page must match this output exactly (spam guard).

import type { FaqItem } from '@/lib/seo/jsonld'

/**
 * Parses Trix-generated HTML into FAQ Q&A pairs.
 * Uses only regex — no DOM globals, safe in all runtimes.
 */
export function parseFaqHtml(html: string): FaqItem[] {
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
