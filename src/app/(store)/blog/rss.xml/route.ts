import { serverWorkerUrl } from '@/lib/server/worker-origin'

export const dynamic = 'force-dynamic'

interface BlogPostSummary {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
}

interface BlogListResponse {
  posts: BlogPostSummary[]
  nextCursor: string | null
}

interface StoreConfig {
  storeName: string
}

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
  let posts: BlogPostSummary[] = []
  try {
    const res = await fetch(`${workerUrl}/api/blog`)
    if (!res.ok) {
      return new Response(null, { status: 404 })
    }
    const data = (await res.json()) as BlogListResponse
    posts = data.posts ?? []
  } catch {
    return new Response(null, { status: 404 })
  }

  // Fetch store name
  let storeName = 'Store'
  try {
    const cfgRes = await fetch(`${workerUrl}/api/config/store`)
    if (cfgRes.ok) {
      const cfg = (await cfgRes.json()) as StoreConfig
      if (cfg.storeName) storeName = cfg.storeName
    }
  } catch {
    // fall back to default
  }

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
