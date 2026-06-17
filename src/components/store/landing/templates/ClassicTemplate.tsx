import { r2Url } from '@/lib/server/fetchFromWorker'
import { HeroSection } from '../HeroSection'
import { StorySection } from '../StorySection'
import { FeaturedProductsStrip } from '../FeaturedProductsStrip'
import { ReviewsStrip } from '../ReviewsStrip'
import { CTABand } from '../CTABand'
import type { LandingTemplateProps } from '@/lib/types'
import { LANDING_SECTION_KEYS } from '@/lib/constants'

export function ClassicTemplate({ landing, storeConfig, t }: LandingTemplateProps) {
  const { sections, featuredProducts } = landing

  return (
    // id kept for skip-link; div instead of main — store layout already wraps in <main>
    <div id="main-content">
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
                t={t}
              />
            )
          case 'story':
            return (
              <StorySection
                key={key}
                section={section}
                imageUrl={r2Url(section.imageR2Key)}
                t={t}
              />
            )
          case 'featured':
            return (
              <FeaturedProductsStrip
                key={key}
                section={section}
                products={featuredProducts}
                t={t}
              />
            )
          case 'reviews':
            return <ReviewsStrip key={key} section={section} />
          case 'cta':
            return <CTABand key={key} section={section} t={t} />
          default:
            return null
        }
      })}
    </div>
  )
}
