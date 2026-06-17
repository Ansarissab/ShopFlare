import { serverWorkerUrl } from '@/lib/server/worker-origin'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import type { BlogListResponse } from '@/lib/types/blog'
import type { StoreConfig } from '@/lib/types/common'

export const dynamic = 'force-dynamic'

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(): Promise<Response> {
  const workerUrl = serverWorkerUrl()
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? (workerUrl ? workerUrl.replace(/\/api$/, '') : '')

  if (!workerUrl) {
    return new Response(null, { status: 404 })
  }

  // Fetch blog posts
  const data = await fetchFromWorker<BlogListResponse>('/api/blog', { revalidate: false })
  if (!data) return new Response(null, { status: 404 })
  const posts = data.posts ?? []

  // Fetch store name
  let storeName = 'Store'
  const cfg = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: false })
  if (cfg?.storeName) storeName = cfg.storeName

  const lastBuildDate = new Date().toUTCString()

  const items = posts
    .map((post) => {
      const link = `${siteUrl}/blog/${post.slug}`
      const pubDate = new Date(post.publishedAt).toUTCString()
      return [
        '    <item>',
        `      <title>${xmlEscape(post.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <description>${xmlEscape(post.excerpt)}</description>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(storeName)} Blog</title>
    <link>${siteUrl}/blog</link>
    <description>Latest articles from ${xmlEscape(storeName)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${siteUrl}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
