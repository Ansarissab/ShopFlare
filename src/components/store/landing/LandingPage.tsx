import { r2Url } from '@/lib/server/fetchFromWorker'
import { HeroSection } from './HeroSection'
import { StorySection } from './StorySection'
import { FeaturedProductsStrip } from './FeaturedProductsStrip'
import { ReviewsStrip } from './ReviewsStrip'
import { CTABand } from './CTABand'
import type { LandingPageProps } from '@/lib/types'
import { LANDING_SECTION_KEYS } from '@/lib/constants'

export function LandingPage({ landing, storeConfig }: LandingPageProps) {
  const { sections, featuredProducts } = landing

  return (
    <main>
      {LANDING_SECTION_KEYS.map((key) => {
        const section = sections[key]
        if (!section?.enabled) return null

        switch (key) {
          case 'hero':
            return (
              <HeroSection
                key={key}
                section={section}
                imageUrl={r2Url(section.imageR2Key)}
                storeName={storeConfig.storeName}
                heroStyle={storeConfig.heroStyle}
              />
            )
          case 'story':
            return <StorySection key={key} section={section} imageUrl={r2Url(section.imageR2Key)} />
          case 'featured':
            return <FeaturedProductsStrip key={key} section={section} products={featuredProducts} />
          case 'reviews':
            return <ReviewsStrip key={key} section={section} />
          case 'cta':
            return <CTABand key={key} section={section} />
          default:
            return null
        }
      })}
    </main>
  )
}
