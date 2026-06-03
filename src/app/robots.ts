import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (workerUrl ? workerUrl.replace(/\/api$/, '') : '')
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] }],
    sitemap: siteUrl ? `${siteUrl}/sitemap.xml` : undefined,
  }
}
