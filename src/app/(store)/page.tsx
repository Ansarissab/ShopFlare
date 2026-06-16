import type { Metadata } from 'next'
import { Suspense } from 'react'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { resolveSiteUrl } from '@/lib/seo/site-url'
import { getT } from '@/lib/i18n/server'
import { JsonLd } from '@/components/shared/JsonLd'
import { organizationJsonLd } from '@/lib/seo/jsonld'
import { isFeatureEnabled } from '@/lib/features'
import type { StoreConfig } from '@/lib/types/common'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import type { LandingData } from '@/lib/types'
import StorePageClient from './StorePageClient'
import { LandingPage } from '@/components/store/landing/LandingPage'

export async function generateMetadata(): Promise<Metadata> {
  const [config, siteUrl] = await Promise.all([
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
    resolveSiteUrl(),
  ])
  return buildPageMetadata({
    title: config?.tagline ?? config?.storeName ?? 'Store',
    description: config?.tagline ?? undefined,
    canonical: `${siteUrl}/`,
    storeName: config?.storeName,
    ...(config?.enabledLocales && config.enabledLocales.length > 0
      ? { localeAlternates: { path: '/', enabledLocales: config.enabledLocales, baseUrl: siteUrl } }
      : {}),
  })
}

export default async function StorePage() {
  const [config, t, siteUrl] = await Promise.all([
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
    getT(),
    resolveSiteUrl(),
  ])

  if (isFeatureEnabled(config, 'landingEnabled')) {
    const [landingRaw, productsRaw] = await Promise.all([
      fetchFromWorker<{ sections: LandingData['sections']; featuredProductIds: string[] }>(
        '/api/landing',
        { revalidate: 60 },
      ),
      fetchFromWorker<{ products: ProductWithVariants[] }>('/api/products', { revalidate: 60 }),
    ])

    const allProducts = productsRaw?.products ?? []
    const featuredIds = landingRaw?.featuredProductIds ?? []
    const featuredProducts = featuredIds
      .map((id) => allProducts.find((p) => p.product.id === id))
      .filter((p): p is ProductWithVariants => Boolean(p))

    const landing: LandingData = {
      sections: landingRaw?.sections ?? ({} as LandingData['sections']),
      featuredProducts,
    }

    return (
      <>
        <JsonLd
          data={organizationJsonLd({
            name: config?.storeName ?? 'Store',
            url: siteUrl,
            logoUrl: config?.logoUrl,
          })}
        />
        <LandingPage
          landing={landing}
          storeConfig={{
            storeName: config?.storeName ?? 'Store',
            tagline: config?.tagline,
            logoUrl: config?.logoUrl,
            heroStyle: config?.heroStyle,
          }}
          t={t}
        />
      </>
    )
  }

  // Server-fetch initial products + categories so Catalog renders the real grid
  // on first paint (eliminates the skeleton→grid CLS swap) and both server and
  // client first-render with the same category list (prevents hydration mismatch
  // caused by the module-level _cache in useApiResource being populated from a
  // previous navigation before Catalog's useState initializer runs on the client).
  const [productsRaw, categoriesRaw] = await Promise.all([
    fetchFromWorker<{ products: ProductWithVariants[] }>('/api/products', { revalidate: 300 }),
    fetchFromWorker<{ categories: CategoryNode[] }>('/api/categories', { revalidate: 300 }),
  ])
  const initialProducts = productsRaw?.products ?? []
  const initialCategories = categoriesRaw?.categories ?? []

  // LCP preload: hint the browser to fetch the first product card image early.
  // Mirrors ProductCard's firstImage selection (lowest sortOrder across all variant images).
  // images.unoptimized=true means next/image with priority won't emit a <link rel=preload>
  // automatically, so we inject it manually from the RSC. Guard: skip if no products/images.
  // images live on variants (mirror ProductGrid: variants.flatMap(v => v.images))
  const firstProductImages = initialProducts[0]?.variants.flatMap((v) => v.images) ?? []
  const lcpImageUrl =
    firstProductImages.length > 0
      ? firstProductImages.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url
      : undefined

  return (
    <>
      {lcpImageUrl && <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" />}
      <Suspense>
        <StorePageClient initialProducts={initialProducts} initialCategories={initialCategories} />
      </Suspense>
    </>
  )
}
