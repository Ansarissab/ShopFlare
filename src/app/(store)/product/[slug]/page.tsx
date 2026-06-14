import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductHeroWrapper } from '@/components/store/product/ProductHeroWrapper'
import { ReviewsSection } from '@/components/store/product/ReviewsSection'
import { JsonLd } from '@/components/shared/JsonLd'
import { layout } from '@/lib/styles'
import { getT } from '@/lib/i18n/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { productJsonLd, breadcrumbListJsonLd, faqPageJsonLd } from '@/lib/seo/jsonld'
import { stripHtml } from '@/lib/html'
import { FaqSection } from '@/components/store/FaqSection'
import { isFeatureEnabled } from '@/lib/features'
import { catalogHref } from '@/lib/nav'
import type { ProductWithVariants } from '@/lib/types/product'
import type { StoreConfig } from '@/lib/types/common'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getT()
  const { slug } = await params
  const [item, config] = await Promise.all([
    fetchFromWorker<ProductWithVariants>(`/api/products/${slug}`, { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!item) return { title: t.product.notFound }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const firstImage = item.variants[0]?.images[0]?.url

  return buildPageMetadata({
    title: item.product.name,
    description: item.product.description ?? undefined,
    canonical: `${siteUrl}/product/${slug}`,
    imageUrl: firstImage,
    storeName: config?.storeName,
    mdUrl: `${siteUrl}/product/${slug}.md`,
  })
}

export default async function ProductDetailPage({ params }: PageProps) {
  const t = await getT()
  const { slug } = await params
  const [item, config, reviewsData] = await Promise.all([
    fetchFromWorker<ProductWithVariants>(`/api/products/${slug}`, { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
    fetchFromWorker<{ reviews: unknown[]; average: number; count: number }>(
      `/api/reviews/product/${slug}`,
      { revalidate: 120 },
    ),
  ])

  if (!item) notFound()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const storeUrl = siteUrl

  const catalogUrl = `${siteUrl}${catalogHref(config?.landingEnabled)}`
  const breadcrumb = breadcrumbListJsonLd([
    { name: config?.storeName ?? 'Home', url: catalogUrl },
    { name: item.product.name, url: `${siteUrl}/product/${slug}` },
  ])

  const productLd = productJsonLd(item, {
    currency: config?.currency,
    storeUrl,
    storeName: config?.storeName,
    rating:
      reviewsData && reviewsData.count > 0
        ? { average: reviewsData.average, count: reviewsData.count }
        : null,
  })
  if (siteUrl) {
    productLd['@id'] = `${siteUrl}/product/${slug}#product`
  }
  if (siteUrl && productLd.brand) {
    ;(productLd.brand as Record<string, unknown>)['@id'] = `${siteUrl}#org`
  }

  return (
    <div className={layout.page}>
      <JsonLd data={breadcrumb} />
      <JsonLd data={productLd} />

      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={catalogHref(config?.landingEnabled)}
          className="hover:text-foreground transition-colors"
        >
          {t.store.allProducts}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground truncate">{item.product.name}</span>
      </nav>

      <ProductHeroWrapper item={item} />
      <ReviewsSection
        productId={item.product.id}
        productName={item.product.name}
        reviewsEnabled={isFeatureEnabled(config, 'reviewsEnabled') && item.product.reviewsEnabled}
        className="mt-10"
      />
      {(item.faqItems?.length ?? 0) > 0 && (
        <>
          <JsonLd
            data={faqPageJsonLd(
              (item.faqItems ?? []).map((faq) => ({
                question: faq.question,
                answer: stripHtml(faq.answer),
              })),
            )}
          />
          <FaqSection items={item.faqItems ?? []} heading={t.product.productFaqHeading} />
        </>
      )}
    </div>
  )
}
