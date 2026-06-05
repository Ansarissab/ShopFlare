'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductGrid } from '@/components/store/product/ProductGrid'
import { SearchBar } from '@/components/store/search/SearchBar'
import { InfiniteScrollSentinel } from '@/components/shared/InfiniteScrollSentinel'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { DEFAULT_PRODUCT_PAGE_SIZE } from '@/lib/constants'
import type { CategoryDetailResponse } from '@/lib/types/category'
import { useApiResource } from '@/hooks/useApiResource'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { useProductSearch } from '@/hooks/useProductSearch'

// ─── Structured data ────────────────────────────────────────────────────────

interface CategoryJsonLdProps {
  name: string
  description?: string | null
  imageUrl?: string | null
  url: string
  breadcrumb: Array<{ name: string; slug: string | null }>
}

function CategoryJsonLd({ name, description, imageUrl, url, breadcrumb }: CategoryJsonLdProps) {
  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumb.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      ...(item.slug !== null ? { item: item.slug } : {}),
    })),
  }

  const collectionPage: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url,
    ...(description ? { description } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPage).replace(/</g, '\\u003c') }} />
    </>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function CategorySkeleton() {
  return (
    <div className={layout.page}>
      <Skeleton className="h-4 w-48 mb-6" />
      <Skeleton className="h-8 w-1/3 mb-2" />
      <Skeleton className="h-4 w-2/3 mb-8" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CategoryPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data, loading, notFound } = useApiResource<CategoryDetailResponse>(
    params?.slug ? `/api/categories/${params.slug}` : null,
  )
  const { config } = useStoreConfig()

  const [query, setQuery] = useState(() => searchParams?.get('q') ?? '')

  // Sync ?q= to URL
  useEffect(() => {
    if (!params?.slug) return
    const currentQ = searchParams?.get('q') ?? ''
    if (currentQ === query) return
    const url = query
      ? `/category/${params.slug}?q=${encodeURIComponent(query)}`
      : `/category/${params.slug}`
    router.replace(url, { scroll: false })
  }, [query, router, searchParams, params?.slug])

  const pageSize = config?.productPageSize ?? DEFAULT_PRODUCT_PAGE_SIZE

  const { visibleItems, hasMore, loadMore, isLoadingMore, totalFiltered } = useProductSearch({
    items: data?.products ?? [],
    pageSize,
    query,
    activeCategoryId: null,
    allCategories: [],
  })

  if (loading) return <CategorySkeleton />

  if (notFound || !data) {
    return (
      <div className={cn(layout.centeredState, 'max-w-7xl')}>
        <h1>{en.product.notFound}</h1>
        <p className="text-muted-foreground text-sm">{en.product.notFoundBody}</p>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          {en.product.backToStore}
        </Link>
      </div>
    )
  }

  const { category, breadcrumb } = data
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const categoryUrl = `${siteUrl}/category/${category.slug}`

  const breadcrumbItems = [
    { name: config?.storeName ?? 'Home', slug: `${siteUrl}/` },
    ...breadcrumb.map((b) => ({ name: b.name, slug: `${siteUrl}/category/${b.slug}` })),
    { name: category.name, slug: categoryUrl },
  ]

  return (
    <div className={layout.page}>
      <CategoryJsonLd
        name={category.name}
        description={category.description}
        imageUrl={category.imageUrl}
        url={categoryUrl}
        breadcrumb={breadcrumbItems}
      />

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/" className="hover:text-foreground transition-colors">
          {config?.storeName ?? 'Home'}
        </Link>
        {breadcrumb.map((b) => (
          <>
            <span key={`sep-${b.id}`} aria-hidden>/</span>
            <Link
              key={b.id}
              href={`/category/${b.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {b.name}
            </Link>
          </>
        ))}
        <span aria-hidden>/</span>
        <span className="text-foreground">{category.name}</span>
      </nav>

      {/* Hero image */}
      {category.imageUrl && (
        <div className="mb-6 overflow-hidden rounded-xl aspect-3/1 w-full bg-muted">
          <img
            src={category.imageUrl}
            alt={category.name}
            className="h-full w-full object-cover"
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

      {/* Search within category */}
      <div className="mb-6">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* Products */}
      {visibleItems.length === 0 ? (
        query ? (
          <div className={cn(layout.centeredState, 'min-h-[30vh]')}>
            <p className="text-muted-foreground">
              {en.store.searchNoResults} &quot;{query}&quot;
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
            >
              {en.store.searchClearHint}
            </button>
          </div>
        ) : (
          <div className={cn(layout.centeredState, 'min-h-[30vh]')}>
            <p className="text-muted-foreground">{en.store.categoryEmpty}</p>
          </div>
        )
      ) : (
        <>
          <ProductGrid
            items={visibleItems}
            storeConfig={{
              flatRateCents: config?.flatShippingRateCents ?? 0,
              thresholdCents: config?.freeShippingThresholdCents ?? 0,
            }}
          />
          <InfiniteScrollSentinel
            onVisible={loadMore}
            isLoading={isLoadingMore}
            hasMore={hasMore}
            totalItems={totalFiltered}
            pageSize={pageSize}
          />
        </>
      )}
    </div>
  )
}
