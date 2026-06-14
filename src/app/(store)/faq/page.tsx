import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/shared/JsonLd'
import { FaqSection } from '@/components/store/FaqSection'
import { layout } from '@/lib/styles'
import { getT } from '@/lib/i18n/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { faqPageJsonLd } from '@/lib/seo/jsonld'
import { isFeatureEnabled } from '@/lib/features'
import { stripHtml } from '@/lib/html'
import type { StoreConfig } from '@/lib/types/common'
import type { FaqItem } from '@/lib/seo/jsonld'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })
  return buildPageMetadata({
    title: t.seo.faqSectionTitle,
    canonical: `${siteUrl}/faq`,
    storeName: config?.storeName,
  })
}

export default async function FaqPage() {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })

  if (!isFeatureEnabled(config, 'faqEnabled')) notFound()

  const items: FaqItem[] = config?.faqItems ?? []
  if (!items.length) notFound()

  const jsonLdItems = items.map((item) => ({
    question: item.question,
    answer: stripHtml(item.answer),
  }))

  return (
    <div className={layout.page}>
      <JsonLd data={faqPageJsonLd(jsonLdItems)} />
      <FaqSection items={items} />
    </div>
  )
}
