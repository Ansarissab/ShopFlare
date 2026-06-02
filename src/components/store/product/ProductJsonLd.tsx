'use client'

// Product JSON-LD structured data (Agent R).
// Emits a schema.org Product script tag with offers + optional aggregateRating.
// Fetches store config (for currency) and review aggregate concurrently.
// Renders null until data is ready; never throws.

import { useEffect, useState } from 'react'
import type { ProductJsonLdProps, ProductJsonLdOffer, ProductReviewsResponse, StoreConfig, SizeOption } from '@/lib/types/store'
import { apiGet } from '@/lib/api'
// getPriceRange lives in the utils/ directory module; `@/lib/utils` resolves to
// the sibling utils.ts (cn only), so the explicit /index path is required.
import { getPriceRange } from '@/lib/utils/index'
import { DEFAULT_CURRENCY, CURRENCIES } from '@/lib/constants'

export function ProductJsonLd({ item, rating: ratingProp, storeUrl, storeName }: ProductJsonLdProps) {
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY)
  const [rating, setRating] = useState<{ average: number; count: number } | null>(
    ratingProp ?? null,
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Fetch store config + reviews concurrently. Failures are silently swallowed.
      const [configResult, reviewsResult] = await Promise.allSettled([
        apiGet<StoreConfig>('/api/config/store'),
        apiGet<ProductReviewsResponse>(`/api/reviews/product/${item.product.id}`),
      ])

      if (cancelled) return

      if (configResult.status === 'fulfilled') {
        setCurrency(configResult.value.currency ?? DEFAULT_CURRENCY)
      }

      // Only set rating from API if caller didn't pass one in as prop.
      if (!ratingProp && reviewsResult.status === 'fulfilled') {
        const r = reviewsResult.value
        if (r.count > 0) {
          setRating({ average: r.average, count: r.count })
        }
      }

      setReady(true)
    }

    load()
    return () => { cancelled = true }
  }, [item.product.id, ratingProp])

  if (!ready) return null

  // Collect all image URLs across all variants.
  const images: string[] = []
  for (const variant of item.variants) {
    for (const img of variant.images) {
      if (img.url) images.push(img.url)
    }
  }

  // Collect all active in-stock sizes across all variants.
  const allSizes: SizeOption[] = item.variants.flatMap(v => v.sizes)
  const { minPrice, maxPrice } = getPriceRange(allSizes)

  // Currency metadata — decimals determine how we convert cents → decimal amount.
  const currencyMeta = CURRENCIES[currency as keyof typeof CURRENCIES] ?? CURRENCIES[DEFAULT_CURRENCY]
  const divisor = Math.pow(10, currencyMeta.decimals)

  // Determine aggregate availability.
  const hasStock = allSizes.some(s => s.active && s.stock !== 0)
  const availability = hasStock
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock'

  // Build Offers block. Use AggregateOffer when a price range exists.
  let offers: ProductJsonLdOffer
  const productUrl = storeUrl ? `${storeUrl}/product/${item.product.id}` : undefined

  if (minPrice !== null && maxPrice !== null) {
    const activeSizes = allSizes.filter(s => s.active && s.stock !== 0)
    if (minPrice === maxPrice) {
      offers = {
        '@type': 'Offer',
        price: minPrice / divisor,
        priceCurrency: currency,
        availability,
        ...(productUrl ? { url: productUrl } : {}),
      }
    } else {
      offers = {
        '@type': 'AggregateOffer',
        lowPrice: minPrice / divisor,
        highPrice: maxPrice / divisor,
        offerCount: activeSizes.length,
        priceCurrency: currency,
        availability,
        ...(productUrl ? { url: productUrl } : {}),
      }
    }
  } else {
    // No priced active sizes — still emit an Offer with availability only.
    offers = {
      '@type': 'Offer',
      priceCurrency: currency,
      availability,
      ...(productUrl ? { url: productUrl } : {}),
    }
  }

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.product.name,
    description: item.product.description ?? undefined,
    ...(images.length > 0 ? { image: images } : {}),
    ...(storeName ? { brand: { '@type': 'Brand', name: storeName } } : {}),
    offers,
  }

  if (rating && rating.count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.average,
      reviewCount: rating.count,
    }
  }

  // Escape `<` so a product name/description containing `</script>` can't break
  // out of the tag. `<` parses back to `<` for JSON-LD consumers.
  const json = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
