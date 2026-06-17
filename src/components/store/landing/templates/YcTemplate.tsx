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
import {
  heroHeading,
  sectionHeading,
  featuredHeading,
  editorialBtn,
  accentBtn,
} from './shared/templateKit'

// ─── YC layout tokens ─────────────────────────────────────────────────────────
// Palette is fully from theme tokens — no hardcoded hex anywhere.
// Layout ESSENCE: minimal, EDITORIAL — mostly bg-background/bg-card, thin
// border-border section dividers, a SINGLE restrained accent (text-accent /
// bg-accent for one rule and button), left-aligned content, comfortable
// reading measure. Substance over flash.
//
// Block rhythm (near-neutral, distinguished by divider):
//   hero      → bg-background / text-foreground
//   story     → bg-card       / text-card-foreground  (slight tonal shift)
//   featured  → bg-background / text-foreground
//   reviews   → bg-card
//   cta       → bg-background / text-foreground       (accent rule + accent btn)
const yc = {
  heroBg: 'bg-background',
  heroText: 'text-foreground',
  storyBg: 'bg-card',
  storyText: 'text-card-foreground',
  storyMuted: 'text-muted-foreground',
  featuredBg: 'bg-background',
  featuredText: 'text-foreground',
  reviewsBg: 'bg-card',
  ctaBg: 'bg-background',
  ctaText: 'text-foreground',
  // Single restrained accent — used ONLY on the top rule, the CTA accent rule,
  // and the CTA button. Never as body text background.
  accentRule: 'bg-accent',
  divider: 'border-t border-border',
} as const

export function YcTemplate({ landing, storeConfig, t }: LandingTemplateProps) {
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
              className={cn(yc.heroBg, 'w-full overflow-hidden')}
            >
              {/* Top accent rule — single restrained colour hit */}
              <div className={cn('h-0.75 w-full', yc.accentRule)} aria-hidden="true" />

              <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
                <div
                  className={cn(
                    'flex flex-col gap-10',
                    imageUrl ? 'lg:flex-row lg:items-center lg:gap-20' : '',
                  )}
                >
                  {/* Text block — left-aligned, editorial */}
                  <div className={cn('flex flex-col gap-6', imageUrl ? 'lg:flex-1' : '')}>
                    <h1 className={cn(yc.heroText, heroHeading)}>{heading}</h1>
                    {subtext && (
                      <p
                        className={cn(
                          yc.heroText,
                          'text-lg sm:text-xl leading-relaxed opacity-70 max-w-xl',
                        )}
                      >
                        {subtext}
                      </p>
                    )}
                    <div className="mt-2">
                      {/* Primary button — restrained square-ish, no pill */}
                      <Link href={ctaHref} className={editorialBtn}>
                        {ctaText}
                      </Link>
                    </div>
                  </div>

                  {/* Hero image — modest, restrained, right-aligned */}
                  {imageUrl && (
                    <div
                      className={cn(
                        'relative w-full shrink-0 overflow-hidden rounded',
                        'h-64 sm:h-80 lg:h-100 lg:w-105',
                      )}
                    >
                      <Image
                        src={imageUrl}
                        alt={heading}
                        fill
                        sizes="(max-width: 1024px) 100vw, 420px"
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
              className={cn(yc.storyBg, 'w-full overflow-hidden', yc.divider)}
            >
              <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8 lg:px-12 lg:py-24">
                <div
                  className={cn(
                    'flex flex-col gap-10',
                    imageUrl ? 'sm:flex-row sm:items-start sm:gap-16' : '',
                  )}
                >
                  {/* Image — optional, modest size */}
                  {imageUrl && (
                    <div
                      className={cn(
                        'relative shrink-0 overflow-hidden rounded',
                        'w-full h-56 sm:w-70 sm:h-70',
                      )}
                    >
                      <Image
                        src={imageUrl}
                        alt={heading}
                        fill
                        sizes="(max-width: 640px) 100vw, 280px"
                        className="object-cover"
                      />
                    </div>
                  )}

                  {/* Editorial copy block — comfortable reading measure */}
                  <div className={cn('flex flex-col gap-4', imageUrl ? 'sm:flex-1' : 'max-w-2xl')}>
                    <h2 className={cn(yc.storyText, sectionHeading)}>{heading}</h2>
                    {section.bodyHtml && (
                      <div className={yc.storyMuted}>
                        <RenderHtml
                          html={section.bodyHtml}
                          className="prose prose-neutral max-w-none prose-p:leading-[1.75] prose-p:text-[1rem]"
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
              className={cn(yc.featuredBg, 'w-full', yc.divider)}
            >
              <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8 lg:px-12">
                <FeaturedGrid
                  products={featuredProducts}
                  heading={heading}
                  headingClassName={cn(yc.featuredText, featuredHeading, 'mb-10')}
                />
              </div>
            </TemplateSection>
          )
        }

        // ── Reviews ───────────────────────────────────────────────────────────
        if (key === 'reviews') {
          return (
            <div key={key} className={cn(yc.reviewsBg, yc.divider)}>
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
            <TemplateSection
              key={key}
              aria-label={heading}
              className={cn(yc.ctaBg, 'w-full', yc.divider)}
            >
              <div className="mx-auto max-w-3xl px-6 py-24 sm:px-8 flex flex-col gap-6">
                {/* Short accent rule above CTA heading — single colour hit */}
                <div className={cn('h-0.5 w-12', yc.accentRule)} aria-hidden="true" />
                <h2 className={cn(yc.ctaText, sectionHeading)}>{heading}</h2>
                {subtext && (
                  <p className={cn(yc.ctaText, 'text-lg leading-relaxed opacity-70 max-w-xl')}>
                    {subtext}
                  </p>
                )}
                <div>
                  {/* Accent button — the one bold colour moment in this template */}
                  <Link href={ctaHref} className={accentBtn}>
                    {ctaText}
                  </Link>
                </div>
              </div>
            </TemplateSection>
          )
        }

        return null
      })}
    </div>
  )
}
