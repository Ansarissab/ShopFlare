// GET /product/:slug.md — LLM-readable markdown for a single product.
// Folder name [slug].md makes the dynamic param key "slug.md".

import { NextRequest, NextResponse } from 'next/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { productToMarkdown } from '@/lib/markdown'
import type { ProductWithVariants } from '@/lib/types/product'
import type { StoreConfig } from '@/lib/types/common'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const resolved = await params
  const slug = resolved['slug.md'] ?? resolved['slug'] ?? ''

  const [item, config] = await Promise.all([
    fetchFromWorker<ProductWithVariants>(`/api/products/${slug}`, { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!item) return new NextResponse(null, { status: 404 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const md = productToMarkdown(item, config, { siteUrl })

  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: `<${siteUrl}/product/${slug}>; rel="canonical"`,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
