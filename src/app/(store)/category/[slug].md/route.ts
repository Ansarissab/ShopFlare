// GET /category/:slug.md — LLM-readable markdown for a single category.
// Folder name [slug].md makes the dynamic param key "slug.md".

import { NextRequest, NextResponse } from 'next/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { categoryToMarkdown } from '@/lib/markdown'
import type { CategoryDetailResponse } from '@/lib/types/category'
import type { StoreConfig } from '@/lib/types/common'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const resolved = await params
  const slug = resolved['slug.md'] ?? resolved['slug'] ?? ''

  const [data, config] = await Promise.all([
    fetchFromWorker<CategoryDetailResponse>(`/api/categories/${slug}`, { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!data) return new NextResponse(null, { status: 404 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const md = categoryToMarkdown(data, config, { siteUrl })

  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: `<${siteUrl}/category/${slug}>; rel="canonical"`,
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
