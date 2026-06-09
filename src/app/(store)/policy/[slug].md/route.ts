// GET /policy/:slug.md — LLM-readable markdown for a policy page.
// Folder name [slug].md makes the dynamic param key "slug.md".

import { NextRequest, NextResponse } from 'next/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { policyToMarkdown } from '@/lib/markdown'
import type { StorePage } from '@/lib/types/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const resolved = await params
  const slug = resolved['slug.md'] ?? resolved['slug'] ?? ''

  const page = await fetchFromWorker<StorePage>(`/api/pages/${slug}`, { revalidate: 300 })

  if (!page) return new NextResponse(null, { status: 404 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const md = policyToMarkdown(page)

  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: `<${siteUrl}/policy/${slug}>; rel="canonical"`,
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  })
}
