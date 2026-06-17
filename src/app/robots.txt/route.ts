import { NextResponse } from 'next/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { serverWorkerUrl } from '@/lib/server/worker-origin'
import { isFeatureEnabled } from '@/lib/features'
import { AI_SEARCH_BOTS, AI_TRAINING_BOTS, BLOCKED_SCRAPER_BOTS } from '@/lib/constants'
import type { StoreConfig } from '@/lib/types/common'

export const revalidate = 3600

export async function GET() {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const workerUrl = serverWorkerUrl()
  const resolvedSiteUrl = siteUrl || (workerUrl ? workerUrl.replace(/\/api$/, '') : '')

  const llmEnabled = isFeatureEnabled(config, 'llmDiscoveryEnabled')
  // aiTrainingAllowed defaults to true if config is unavailable
  const aiTrainingAllowed = config?.aiTrainingAllowed !== false

  const lines: string[] = []

  // ── Classic policy (always) ───────────────────────────────────────────────
  lines.push('User-agent: *')
  lines.push('Allow: /')
  lines.push('Disallow: /admin/')
  lines.push('Disallow: /api/')
  lines.push('')

  // ── SEO search engine crawlers (always) ───────────────────────────────────
  lines.push('User-agent: Googlebot')
  lines.push('Allow: /')
  lines.push('Crawl-delay: 2')
  lines.push('')

  lines.push('User-agent: Bingbot')
  lines.push('Allow: /')
  lines.push('Crawl-delay: 5')
  lines.push('')

  // ── AI search / answer bots (when LLM discovery enabled) ─────────────────
  if (llmEnabled) {
    for (const bot of AI_SEARCH_BOTS) {
      lines.push(`User-agent: ${bot}`)
      lines.push('Allow: /')
      lines.push('')
    }

    // Training bots — governed by aiTrainingAllowed flag
    for (const bot of AI_TRAINING_BOTS) {
      lines.push(`User-agent: ${bot}`)
      lines.push(aiTrainingAllowed ? 'Allow: /' : 'Disallow: /')
      lines.push('')
    }

    // Content-Signal header (emerging standard)
    if (!aiTrainingAllowed) {
      lines.push('# Content-Signal: ai-train=no')
      lines.push('')
    }
  }

  // ── SEO scraper blocks (always) ───────────────────────────────────────────
  for (const bot of BLOCKED_SCRAPER_BOTS) {
    lines.push(`User-agent: ${bot}`)
    lines.push('Disallow: /')
    lines.push('')
  }

  // ── Sitemap ───────────────────────────────────────────────────────────────
  if (resolvedSiteUrl) {
    lines.push(`Sitemap: ${resolvedSiteUrl}/sitemap.xml`)
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
