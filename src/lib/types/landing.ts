import type { LandingSectionKey } from '@/lib/constants'
import type { Dictionary } from '@/lib/i18n'
import type { ProductWithVariants } from './product'

export interface LandingSection {
  sectionKey: LandingSectionKey
  enabled: boolean
  heading: string | null
  subtext: string | null
  bodyHtml: string | null
  ctaText: string | null
  ctaHref: string | null
  imageR2Key: string | null
  updatedAt: string
}

export interface LandingData {
  sections: Record<LandingSectionKey, LandingSection>
  featuredProducts: ProductWithVariants[]
}

// Props consumed by the server LandingPage component and its children.
export interface LandingPageProps {
  landing: LandingData
  storeConfig: { storeName: string; tagline?: string; logoUrl?: string; heroStyle?: string }
  t: Dictionary
}

export interface HeroSectionProps {
  section: LandingSection
  heroStyle?: string
  /** Brand fallback for the hero heading when no custom heading is set (white-label). */
  storeName?: string
  t: Dictionary
}

export interface StorySectionProps {
  section: LandingSection
  t: Dictionary
}

export interface FeaturedProductsStripProps {
  section: LandingSection
  products: ProductWithVariants[]
  t: Dictionary
}

export interface ReviewsStripProps {
  section: LandingSection
}

export interface CTABandProps {
  section: LandingSection
  t: Dictionary
}

export interface AdminLandingResponse {
  sections: Record<LandingSectionKey, LandingSection>
  featuredProductIds: string[]
}

export interface StoreReviewsResponse {
  reviews: Array<{
    id: string
    customerName: string
    rating: number
    body: string | null
    createdAt: string
  }>
}
