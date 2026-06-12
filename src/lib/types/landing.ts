import type { LandingSectionKey } from '@/lib/constants'
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
  storeConfig: { storeName: string; tagline?: string; logoUrl?: string }
}

export interface HeroSectionProps {
  section: LandingSection
  heroStyle?: string
  /** Brand fallback for the hero heading when no custom heading is set (white-label). */
  storeName?: string
}

export interface StorySectionProps {
  section: LandingSection
}

export interface FeaturedProductsStripProps {
  section: LandingSection
  products: ProductWithVariants[]
}

export interface ReviewsStripProps {
  section: LandingSection
}

export interface CTABandProps {
  section: LandingSection
}
