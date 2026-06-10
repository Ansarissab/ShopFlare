import type { Metadata } from 'next'
import { Suspense } from 'react'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/shared/JsonLd'
import { FaqSection } from '@/components/store/FaqSection'
import { parseFaq } from '@/lib/html'
import { faqPageJsonLd, organizationJsonLd } from '@/lib/seo/jsonld'
import { isFeatureEnabled } from '@/lib/features'
import { layout } from '@/lib/styles'
import type { StoreConfig } from '@/lib/types/common'
import type { ProductWithVariants } from '@/lib/types/product'
import type { LandingData } from '@/lib/types'
import StorePageClient from './StorePageClient'
import { LandingPage } from '@/components/store/landing/LandingPage'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })
  return buildPageMetadata({
    title: config?.tagline ?? config?.storeName ?? 'Store',
    description: config?.tagline ?? undefined,
    canonical: `${siteUrl}/`,
    storeName: config?.storeName,
  })
}

export default async function StorePage() {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })

  const faqItems =
    isFeatureEnabled(config, 'faqEnabled') && config?.faqContent ? parseFaq(config.faqContent) : []

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
        {faqItems.length > 0 && <JsonLd data={faqPageJsonLd(faqItems)} />}
        <LandingPage
          landing={landing}
          storeConfig={{
            storeName: config?.storeName ?? 'Store',
            tagline: config?.tagline,
            logoUrl: config?.logoUrl,
          }}
        />
        {faqItems.length > 0 && (
          <div className={layout.page}>
            <FaqSection items={faqItems} />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {faqItems.length > 0 && <JsonLd data={faqPageJsonLd(faqItems)} />}
      <Suspense>
        <StorePageClient />
      </Suspense>
      {faqItems.length > 0 && (
        <div className={layout.page}>
          <FaqSection items={faqItems} />
        </div>
      )}
    </>
  )
}
