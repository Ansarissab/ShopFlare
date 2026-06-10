import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/constants'
import { getPriceRange } from '@/lib/utils/index'
import type { ProductWithVariants, SizeOption } from '@/lib/types/product'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JsonLdOffer {
  '@type': 'Offer' | 'AggregateOffer'
  priceCurrency: string
  availability: string
  url?: string
  price?: number
  lowPrice?: number
  highPrice?: number
  offerCount?: number
}

export interface AggregateRatingData {
  average: number
  count: number
}

export interface BreadcrumbItem {
  name: string
  /** Absolute URL or null for last item */
  url: string | null
}

export interface ArticleData {
  title: string
  description?: string
  url: string
  imageUrl?: string
  datePublished?: string
  dateModified?: string
  authorName?: string
}

export interface FaqItem {
  question: string
  answer: string
}

// ─── Product ─────────────────────────────────────────────────────────────────

export function productJsonLd(
  item: ProductWithVariants,
  opts: {
    currency?: string
    storeUrl?: string
    storeName?: string
    rating?: AggregateRatingData | null
  } = {},
): Record<string, unknown> {
  const currency = opts.currency ?? DEFAULT_CURRENCY
  const currencyMeta =
    CURRENCIES[currency as keyof typeof CURRENCIES] ?? CURRENCIES[DEFAULT_CURRENCY]
  const divisor = Math.pow(10, currencyMeta.decimals)

  const images: string[] = []
  for (const variant of item.variants) {
    for (const img of variant.images) {
      if (img.url) images.push(img.url)
    }
  }

  const allSizes: SizeOption[] = item.variants.flatMap((v) => v.sizes)
  const { minPrice, maxPrice } = getPriceRange(allSizes)
  const hasStock = allSizes.some((s) => s.active && s.stock !== 0)
  const availability = hasStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
  const productUrl = opts.storeUrl ? `${opts.storeUrl}/product/${item.product.id}` : undefined

  let offer: JsonLdOffer
  if (minPrice !== null && maxPrice !== null && minPrice !== maxPrice) {
    const activeSizes = allSizes.filter((s) => s.active && s.stock !== 0)
    offer = {
      '@type': 'AggregateOffer',
      lowPrice: minPrice / divisor,
      highPrice: maxPrice / divisor,
      offerCount: activeSizes.length,
      priceCurrency: currency,
      availability,
      ...(productUrl ? { url: productUrl } : {}),
    }
  } else if (minPrice !== null) {
    offer = {
      '@type': 'Offer',
      price: minPrice / divisor,
      priceCurrency: currency,
      availability,
      ...(productUrl ? { url: productUrl } : {}),
    }
  } else {
    offer = { '@type': 'Offer', priceCurrency: currency, availability }
  }

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.product.name,
    ...(item.product.description ? { description: item.product.description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    ...(opts.storeName ? { brand: { '@type': 'Brand', name: opts.storeName } } : {}),
    offers: offer,
  }

  if (opts.rating && opts.rating.count > 0) {
    jsonLd.aggregateRating = aggregateRatingJsonLd(opts.rating)
  }

  return jsonLd
}

// ─── AggregateRating ──────────────────────────────────────────────────────────

export function aggregateRatingJsonLd(rating: AggregateRatingData): Record<string, unknown> {
  return {
    '@type': 'AggregateRating',
    ratingValue: rating.average,
    reviewCount: rating.count,
  }
}

// ─── Organization ─────────────────────────────────────────────────────────────

export function organizationJsonLd(opts: {
  name: string
  url?: string
  logoUrl?: string
  email?: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: opts.name,
    ...(opts.url ? { url: opts.url } : {}),
    ...(opts.logoUrl ? { logo: opts.logoUrl } : {}),
    ...(opts.email ? { email: opts.email } : {}),
  }
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────

export function breadcrumbListJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  }
}

// ─── CollectionPage (category) ────────────────────────────────────────────────

export function collectionPageJsonLd(opts: {
  name: string
  url: string
  description?: string | null
  imageUrl?: string | null
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    url: opts.url,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.imageUrl ? { image: opts.imageUrl } : {}),
  }
}

// ─── FAQPage ──────────────────────────────────────────────────────────────────

export function faqPageJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

// ─── Article (blog) ───────────────────────────────────────────────────────────

export function articleJsonLd(data: ArticleData): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    url: data.url,
    ...(data.description ? { description: data.description } : {}),
    ...(data.imageUrl ? { image: data.imageUrl } : {}),
    ...(data.datePublished ? { datePublished: data.datePublished } : {}),
    ...(data.dateModified ? { dateModified: data.dateModified } : {}),
    ...(data.authorName ? { author: { '@type': 'Person', name: data.authorName } } : {}),
  }
}

// ─── Offer / AggregateOffer (re-export for per-type use) ──────────────────────

export function offerJsonLd(opts: {
  price: number
  currency: string
  availability: 'InStock' | 'OutOfStock'
  url?: string
}): JsonLdOffer {
  return {
    '@type': 'Offer',
    price: opts.price,
    priceCurrency: opts.currency,
    availability: `https://schema.org/${opts.availability}`,
    ...(opts.url ? { url: opts.url } : {}),
  }
}
