import type { MetadataRoute } from 'next'
import { POLICY_SLUGS } from '@/lib/constants'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (workerUrl ? workerUrl.replace(/\/api$/, '') : '')

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl || '/', changeFrequency: 'daily', priority: 1 },
    ...POLICY_SLUGS.map((slug) => ({
      url: `${siteUrl}/policy/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ]

  let productRoutes: MetadataRoute.Sitemap = []
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/api/products`, { next: { revalidate: 3600 } })
      if (res.ok) {
        const products = (await res.json()) as Array<{ slug?: string; id: string }>
        productRoutes = products
          .filter((p) => p.slug)
          .map((p) => ({
            url: `${siteUrl}/product/${p.slug}`,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
          }))
      }
    } catch {
      // worker unavailable at build time — only static routes included
    }
  }

  return [...staticRoutes, ...productRoutes]
}
