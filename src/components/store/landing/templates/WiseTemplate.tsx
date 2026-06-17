import Image from 'next/image'
import Link from 'next/link'
import { r2Url } from '@/lib/server/fetchFromWorker'
import { RenderHtml } from '@/components/shared/RenderHtml'
import { ReviewsStrip } from '../ReviewsStrip'
import { TemplateSection } from './shared/TemplateSection'
import { FeaturedGrid } from './shared/FeaturedGrid'
import { cn } from '@/lib/utils'
import { LANDING_SECTION_KEYS } from '@/lib/constants'
import type { LandingTemplateProps } from '@/lib/types'
import { heroHeading, sectionHeading, featuredHeading, accentBtn } from './shared/templateKit'

// ─── Wise layout tokens ───────────────────────────────────────────────────────
// Palette is fully from theme tokens — no hardcoded hex anywhere.
// Layout ESSENCE: bold, friendly, BLOCKY — full-width alternating colour blocks,
// generous whitespace, large type, big rounded corners.
//
// Block rhythm (alternating):
//   hero      → bg-primary  text-primary-foreground   (bold, inviting)
//   story     → bg-muted    text-foreground            (warm contrast block — AA safe)
//   featured  → bg-card     text-card-foreground      (clean product canvas)
//   reviews   → bg-muted    text-muted-foreground     (soft off-canvas)
//   cta       → bg-primary  text-primary-foreground   (bookend with hero)
//
// NOTE: story was formerly bg-accent/text-accent-foreground (#4A7C6F/#FAFAF7 ≈ 4.48:1)
// which fails WCAG 2 AA for normal-size body text. Switched to bg-muted/text-foreground
// (~14:1). The accent colour is kept as a decorative rule above the heading
// and on the large h2 itself (text-accent at text-2xl/text-3xl ≥ 24 px satisfies
// the 3:1 large-text threshold). accentBtn is imported from the shared kit which
// was similarly fixed (bg-primary) so no white-on-accent label anywhere.
const wise = {
  heroBg: 'bg-primary',
  heroText: 'text-primary-foreground',
  storyBg: 'bg-muted',
  storyText: 'text-foreground',
  // text-muted-foreground (#6B6B62) on bg-muted (#EBEBE4) = 4.49:1 — fails AA
  // for normal 16px body text by 0.01. Use text-foreground (#1A1A18) ≈ 14.8:1.
  storyBody: 'text-foreground',
  featuredBg: 'bg-card',
  featuredText: 'text-card-foreground',
  reviewsBg: 'bg-muted',
  reviewsText: 'text-muted-foreground',
  ctaBg: 'bg-primary',
  ctaText: 'text-primary-foreground',
  // Big pill radius — signature Wise "chunky" feel
  rounded: 'rounded-2xl',
  roundedLg: 'rounded-3xl',
} as const

export function WiseTemplate({ landing, storeConfig, t }: LandingTemplateProps) {
  const { sections, featuredProducts } = landing

  return (
    <div id="main-content">
      {LANDING_SECTION_KEYS.map((key) => {
        const section = sections[key]
        if (!section?.enabled) return null

        // ── Hero ──────────────────────────────────────────────────────────────
        if (key === 'hero') {
          const heading = section.heading || storeConfig.storeName || t.store.heroDefaultHeading
          const subtext = section.subtext || t.store.heroDefaultSubtext
          const ctaText = section.ctaText || t.store.heroDefaultCta
          const ctaHref = section.ctaHref || '/shop'
          const imageUrl = r2Url(section.imageR2Key)

          return (
            <TemplateSection
              key={key}
              aria-label={heading}
              className={cn(wise.heroBg, 'w-full overflow-hidden')}
            >
              <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
                <div
                  className={cn(
                    'flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16',
                    imageUrl ? '' : 'lg:max-w-3xl',
                  )}
                >
                  {/* Text block */}
                  <div className="flex-1 flex flex-col gap-6">
                    <h1 className={cn(wise.heroText, heroHeading)}>{heading}</h1>
                    {subtext && (
                      <p
                        className={cn(
                          wise.heroText,
                          'text-lg sm:text-xl opacity-80 max-w-md leading-relaxed',
                        )}
                      >
                        {subtext}
                      </p>
                    )}
                    <div>
                      {/* On the primary block, use the accent button for contrast */}
                      <Link
                        href={ctaHref}
                        className={cn(accentBtn, wise.roundedLg, 'px-9 py-4 text-base min-h-13')}
                      >
                        {ctaText}
                      </Link>
                    </div>
                  </div>

                  {/* Hero image — large, blocky rounded corners */}
                  {imageUrl && (
                    <div
                      className={cn(
                        'relative w-full overflow-hidden shrink-0',
                        'h-72 sm:h-96 lg:h-120 lg:w-120',
                        wise.roundedLg,
                      )}
                    >
                      <Image
                        src={imageUrl}
                        alt={heading}
                        fill
                        sizes="(max-width: 1024px) 100vw, 480px"
                        className="object-cover"
                        priority
                      />
                    </div>
                  )}
                </div>
              </div>
            </TemplateSection>
          )
        }

        // ── Story ─────────────────────────────────────────────────────────────
        if (key === 'story') {
          const heading = section.heading || t.store.storyDefaultHeading
          const imageUrl = r2Url(section.imageR2Key)

          return (
            <TemplateSection
              key={key}
              aria-label={heading}
              className={cn(wise.storyBg, 'w-full overflow-hidden')}
            >
              <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
                <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:gap-16">
                  {/* Image — big rounded corners */}
                  {imageUrl && (
                    <div
                      className={cn(
                        'relative shrink-0 overflow-hidden',
                        'w-full h-64 sm:w-85 sm:h-85',
                        wise.rounded,
                      )}
                    >
                      <Image
                        src={imageUrl}
                        alt={heading}
                        fill
                        sizes="(max-width: 640px) 100vw, 340px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  {/* Copy block */}
                  <div className="flex-1 flex flex-col gap-4">
                    {/* Accent rule — decorative colour hit (no text on it, AA safe) */}
                    <div className="h-1 w-12 rounded-full bg-accent" aria-hidden="true" />
                    {/* h2 is text-2xl/text-3xl (≥24 px) — large text, 3:1 threshold applies.
                        text-accent on bg-muted ≈ 4.15:1 which exceeds 3:1 large-text AA. */}
                    <h2 className={cn('text-accent', sectionHeading)}>{heading}</h2>
                    {section.bodyHtml && (
                      <div className={wise.storyBody}>
                        <RenderHtml
                          html={section.bodyHtml}
                          className="prose prose-neutral max-w-none prose-p:leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TemplateSection>
          )
        }

        // ── Featured Products ─────────────────────────────────────────────────
        if (key === 'featured') {
          if (featuredProducts.length === 0) return null
          const heading = section.heading || t.store.featuredProductsHeading

          return (
            <TemplateSection
              key={key}
              aria-label={heading}
              className={cn(wise.featuredBg, 'w-full')}
            >
              <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
                <FeaturedGrid
                  products={featuredProducts}
                  heading={heading}
                  headingClassName={cn(wise.featuredText, featuredHeading, 'mb-10')}
                />
              </div>
            </TemplateSection>
          )
        }

        // ── Reviews ───────────────────────────────────────────────────────────
        if (key === 'reviews') {
          return (
            <div key={key} className={cn(wise.reviewsBg, wise.reviewsText)}>
              <ReviewsStrip section={section} />
            </div>
          )
        }

        // ── CTA Band ──────────────────────────────────────────────────────────
        if (key === 'cta') {
          const heading = section.heading || t.store.ctaDefaultHeading
          const subtext = section.subtext || t.store.ctaDefaultSubtext
          const ctaText = section.ctaText || t.store.ctaDefaultCta
          const ctaHref = section.ctaHref || '/shop'

          return (
            <TemplateSection key={key} aria-label={heading} className={cn(wise.ctaBg, 'w-full')}>
              <div className="mx-auto max-w-3xl px-6 py-24 sm:px-8 text-center flex flex-col items-center gap-6">
                <h2 className={cn(wise.ctaText, sectionHeading)}>{heading}</h2>
                {subtext && (
                  <p className={cn(wise.ctaText, 'text-lg opacity-80 max-w-xl leading-relaxed')}>
                    {subtext}
                  </p>
                )}
                {/* On the primary block, accent button for contrast */}
                <Link
                  href={ctaHref}
                  className={cn(accentBtn, wise.roundedLg, 'px-9 py-4 text-base min-h-13')}
                >
                  {ctaText}
                </Link>
              </div>
            </TemplateSection>
          )
        }

        return null
      })}
    </div>
  )
}
