import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { isFeatureEnabled } from '@/lib/features'
import { Catalog } from '@/components/store/Catalog'
import type { StoreConfig } from '@/lib/types/common'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })
  return buildPageMetadata({
    title: config?.tagline ?? config?.storeName ?? 'Shop',
    description: config?.tagline ?? undefined,
    canonical: `${siteUrl}/shop`,
    storeName: config?.storeName,
  })
}

export default async function ShopPage() {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })

  // /shop only exists when landingEnabled is ON; flag OFF → 404
  if (!isFeatureEnabled(config, 'landingEnabled')) {
    notFound()
  }

  return (
    <Suspense>
      <Catalog basePath="/shop" />
    </Suspense>
  )
}
