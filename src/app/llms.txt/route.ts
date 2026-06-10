// Dynamic /llms.txt — LLM-readable store index.
// Returns 404 when the llmDiscoveryEnabled feature flag is off.
// Pages are fetched individually (no list endpoint) using POLICY_SLUGS.

import { NextResponse } from 'next/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { isFeatureEnabled } from '@/lib/features'
import { POLICY_SLUGS } from '@/lib/constants'
import type { StoreConfig } from '@/lib/types/common'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import type { StorePage } from '@/lib/types/admin'

export const revalidate = 3600

export async function GET() {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })

  if (!isFeatureEnabled(config, 'llmDiscoveryEnabled')) {
    return new NextResponse(null, { status: 404 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const lines: string[] = []

  lines.push(`# ${config?.storeName ?? 'Store'}`)
  if (config?.tagline) lines.push(config.tagline)
  lines.push('')

  // Products
  const productsData = await fetchFromWorker<{ products: ProductWithVariants[] }>('/api/products', {
    revalidate: 3600,
  }).catch(() => null)
  if (productsData?.products?.length) {
    lines.push('## Products')
    for (const item of productsData.products.slice(0, 50)) {
      const desc = item.product.description
        ? ': ' + item.product.description.replace(/<[^>]+>/g, '').slice(0, 80)
        : ''
      lines.push(`- [${item.product.name}](${siteUrl}/product/${item.product.id})${desc}`)
    }
    lines.push('')
  }

  // Categories
  const catData = await fetchFromWorker<{ categories: CategoryNode[] }>('/api/categories', {
    revalidate: 3600,
  }).catch(() => null)
  if (catData?.categories?.length) {
    lines.push('## Categories')
    for (const cat of catData.categories) {
      const desc = cat.description ? ': ' + cat.description.slice(0, 80) : ''
      lines.push(`- [${cat.name}](${siteUrl}/category/${cat.slug})${desc}`)
    }
    lines.push('')
  }

  // Policies — fetched individually (no list endpoint)
  const pageResults = await Promise.all(
    POLICY_SLUGS.map((slug) =>
      fetchFromWorker<StorePage>(`/api/pages/${slug}`, { revalidate: 3600 }).catch(() => null),
    ),
  )
  const pages = pageResults.filter((p): p is StorePage => p !== null)
  if (pages.length) {
    lines.push('## Policies')
    for (const page of pages) {
      lines.push(`- [${page.title}](${siteUrl}/policy/${page.slug})`)
    }
    lines.push('')
  }

  const body = lines.join('\n')
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
