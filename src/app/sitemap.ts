// Dynamic sitemap (Agent R).
// Fetches active products from the CF Worker and emits one URL per product.
// Falls back to static routes only if the fetch fails.

import type { MetadataRoute } from 'next'
import { WORKER_URL } from '@/lib/api'
import type { ProductWithVariants } from '@/lib/types/product'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://your-store.example.com'

// Static routes that are always included.
const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: SITE_URL,
    changeFrequency: 'daily',
    priority: 1.0,
    lastModified: new Date(),
  },
  {
    url: `${SITE_URL}/track`,
    changeFrequency: 'monthly',
    priority: 0.3,
  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let productEntries: MetadataRoute.Sitemap = []

  try {
    const data = await fetch(`${WORKER_URL}/api/products`, {
      next: { revalidate: 3600 }, // revalidate hourly
    }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<{ products: ProductWithVariants[] }>
    })

    productEntries = data.products.map(({ product }) => ({
      url: `${SITE_URL}/product/${product.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      lastModified: new Date(),
    }))
  } catch {
    // Worker unavailable at build time — degrade to static-only sitemap.
    productEntries = []
  }

  return [...STATIC_ROUTES, ...productEntries]
}
