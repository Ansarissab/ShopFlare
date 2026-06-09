import type { Metadata } from 'next'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/shared/JsonLd'
import { FaqSection } from '@/components/store/FaqSection'
import { parseFaq } from '@/lib/html'
import { faqPageJsonLd } from '@/lib/seo/jsonld'
import { isFeatureEnabled } from '@/lib/features'
import { layout } from '@/lib/styles'
import type { StoreConfig } from '@/lib/types/common'
import StorePageClient from './StorePageClient'

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
    isFeatureEnabled(config, 'faqEnabled') && config?.faqContent
      ? parseFaq(config.faqContent)
      : []

  return (
    <>
      {faqItems.length > 0 && <JsonLd data={faqPageJsonLd(faqItems)} />}
      <StorePageClient />
      {faqItems.length > 0 && (
        <div className={layout.page}>
          <FaqSection items={faqItems} />
        </div>
      )}
    </>
  )
}
