import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { JsonLd } from '@/components/shared/JsonLd'
import { CategoryProductSection } from '@/components/store/categories/CategoryProductSection'
import { layout } from '@/lib/styles'
import { getT } from '@/lib/i18n/server'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { breadcrumbListJsonLd, collectionPageJsonLd } from '@/lib/seo/jsonld'
import { DEFAULT_PRODUCT_PAGE_SIZE } from '@/lib/constants'
import { catalogHref } from '@/lib/nav'
import type { CategoryDetailResponse } from '@/lib/types/category'
import type { StoreConfig } from '@/lib/types/common'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getT()
  const { slug } = await params
  const [data, config] = await Promise.all([
    fetchFromWorker<CategoryDetailResponse>(`/api/categories/${slug}`, { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!data) return { title: t.product.notFound }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  return buildPageMetadata({
    title: data.category.name,
    description: data.category.description ?? undefined,
    canonical: `${siteUrl}/category/${slug}`,
    imageUrl: data.category.imageUrl ?? undefined,
    storeName: config?.storeName,
    mdUrl: `${siteUrl}/category/${slug}.md`,
  })
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { q } = await searchParams

  const [data, config] = await Promise.all([
    fetchFromWorker<CategoryDetailResponse>(`/api/categories/${slug}`, { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!data) notFound()

  const { category, breadcrumb, products } = data
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const categoryUrl = `${siteUrl}/category/${category.slug}`

  const catalogUrl = `${siteUrl}${catalogHref(config?.landingEnabled)}`
  const breadcrumbItems = [
    { name: config?.storeName ?? 'Home', url: catalogUrl },
    ...breadcrumb.map((b) => ({ name: b.name, url: `${siteUrl}/category/${b.slug}` })),
    { name: category.name, url: categoryUrl },
  ]

  const pageSize = config?.productPageSize ?? DEFAULT_PRODUCT_PAGE_SIZE

  return (
    <div className={layout.page}>
      <JsonLd data={breadcrumbListJsonLd(breadcrumbItems)} />
      <JsonLd
        data={collectionPageJsonLd({
          name: category.name,
          url: categoryUrl,
          description: category.description,
          imageUrl: category.imageUrl,
        })}
      />

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link
          href={catalogHref(config?.landingEnabled)}
          className="hover:text-foreground transition-colors"
        >
          {config?.storeName ?? 'Home'}
        </Link>
        {breadcrumb.map((b) => (
          <span key={b.id} className="flex items-center gap-2">
            <span aria-hidden>/</span>
            <Link href={`/category/${b.slug}`} className="hover:text-foreground transition-colors">
              {b.name}
            </Link>
          </span>
        ))}
        <span aria-hidden>/</span>
        <span className="text-foreground">{category.name}</span>
      </nav>

      {/* Hero image */}
      {category.imageUrl && (
        <div className="relative mb-6 overflow-hidden rounded-xl aspect-3/1 w-full bg-muted">
          <Image
            src={category.imageUrl}
            alt={category.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Heading + description */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-2 text-muted-foreground">{category.description}</p>
        )}
      </div>

      {/* Client island: search + product grid + infinite scroll */}
      <CategoryProductSection
        slug={slug}
        products={products}
        pageSize={pageSize}
        flatRateCents={config?.flatShippingRateCents ?? 0}
        thresholdCents={config?.freeShippingThresholdCents ?? 0}
        initialQuery={q ?? ''}
      />
    </div>
  )
}
