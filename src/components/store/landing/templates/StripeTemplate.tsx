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
  inverseBtn,
  ghostBtn,
} from './shared/templateKit'

// ─── Stripe layout tokens ─────────────────────────────────────────────────────
// Palette is fully from theme tokens — no hardcoded hex anywhere.
// Layout ESSENCE: refined, PRECISE, gradient — tasteful gradient hero from
// theme tokens, crisp grid alignment, thin border-border dividers, subtle
// shadows, controlled whitespace, overline labels.
//
// Block rhythm:
//   hero      → gradient from-primary to-accent / text-primary-foreground
//   story     → bg-muted (off-white/off-dark)   / text-muted-foreground
//   featured  → bg-background                   / text-foreground
//   reviews   → bg-muted
//   cta       → gradient from-primary to-accent / text-primary-foreground
const stripe = {
  heroBg: 'bg-gradient-to-br from-primary via-primary to-accent',
  heroText: 'text-primary-foreground',
  heroSubText: 'text-primary-foreground/75',
  storyBg: 'bg-muted',
  storyHeading: 'text-foreground',
  // text-muted-foreground (#6B6B62) on bg-muted (#EBEBE4) = 4.49:1 — fails WCAG AA
  // (4.5 minimum) for 16px normal text by 0.01. Use text-foreground (~14.8:1).
  storyBody: 'text-foreground',
  featuredBg: 'bg-background',
  featuredText: 'text-foreground',
  featuredSub: 'text-muted-foreground',
  reviewsBg: 'bg-muted',
  ctaBg: 'bg-gradient-to-br from-primary via-primary to-accent',
  ctaText: 'text-primary-foreground',
  ctaSubText: 'text-primary-foreground/80',
  // Decorative tokens
  divider: 'border-border',
  imageRing: 'ring-1 ring-border',
  imageShadow: 'shadow-[0_8px_32px_-6px_hsl(var(--foreground)/0.12)]',
  // text-accent (#4A7C6F) on bg-background (#FAFAF7) ≈ 4.48:1 — fails AA for
  // normal/small text. text-muted-foreground (#6B6B62) on background ≈ 4.75:1
  // which clears the 4.5 AA threshold while still reading as a subdued label.
  overlineText: 'text-muted-foreground',
} as const

// ── Gradient mesh blobs — depth without DOM weight ────────────────────────────
// Uses CSS opacity on theme-token colours so they adapt to light/dark mode.
function HeroMesh() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Top-right bloom — primary colour */}
      <div className="absolute -top-32 -inset-e-32 h-125 w-125 rounded-full bg-primary-foreground/10" />
      {/* Bottom-left whisper — accent colour */}
      <div className="absolute -bottom-24 -inset-s-24 h-95 w-95 rounded-full bg-accent-foreground/5" />
    </div>
  )
}

export function StripeTemplate({ landing, storeConfig, t }: LandingTemplateProps) {
  const { sections, featuredProducts } = landing

  return (
    <div id="main-content">
      {LANDING_SECTION_KEYS.map((key) => {
        const section = sections[key]
        if (!section?.enabled) return null

        // ── Hero ────────────────────────────────────────────────────────────────
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
              className={cn(stripe.heroBg, 'relative w-full overflow-hidden')}
            >
              <HeroMesh />

              <div className="relative mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-32">
                <div
                  className={cn(
                    'flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-20',
                    imageUrl ? '' : 'lg:max-w-3xl',
                  )}
                >
                  {/* Text column */}
                  <div className="flex-1 flex flex-col gap-7">
                    <h1 className={cn(stripe.heroText, heroHeading, 'tracking-[-0.02em]')}>
                      {heading}
                    </h1>

                    {subtext && (
                      <p
                        className={cn(
                          stripe.heroSubText,
                          'text-lg sm:text-xl leading-relaxed max-w-lg',
                        )}
                      >
                        {subtext}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {/* Card/inverse button: white bg on gradient hero */}
                      <Link href={ctaHref} className={inverseBtn}>
                        {ctaText}
                      </Link>
                      {/* Secondary ghost link — Stripe pattern: text link beside pill CTA */}
                      <Link
                        href="/shop"
                        className={cn(ghostBtn, stripe.heroText, 'opacity-80 hover:opacity-100')}
                      >
                        {t.store.featuredProductsHeading} →
                      </Link>
                    </div>
                  </div>

                  {/* Hero image — precise rounding, subtle ring + shadow */}
                  {imageUrl && (
                    <div
                      className={cn(
                        'relative w-full shrink-0 overflow-hidden',
                        'h-72 sm:h-100 lg:h-120 lg:w-120',
                        'rounded-2xl',
                        'ring-1 ring-primary-foreground/10 shadow-[0_20px_60px_-12px_hsl(var(--foreground)/0.4)]',
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

        // ── Story ───────────────────────────────────────────────────────────────
        if (key === 'story') {
          const heading = section.heading || t.store.storyDefaultHeading
          const imageUrl = r2Url(section.imageR2Key)

          return (
            <TemplateSection
              key={key}
              aria-label={heading}
              className={cn(stripe.storyBg, 'w-full overflow-hidden')}
            >
              <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
                <div
                  className={cn(
                    'flex flex-col gap-12',
                    imageUrl
                      ? 'lg:flex-row lg:items-center lg:gap-20'
                      : 'max-w-3xl mx-auto text-center',
                  )}
                >
                  {/* Optional image — card treatment: shadow + subtle ring */}
                  {imageUrl && (
                    <div
                      className={cn(
                        'relative shrink-0 overflow-hidden',
                        'w-full h-64 sm:w-95 sm:h-95',
                        'rounded-2xl',
                        stripe.imageRing,
                        stripe.imageShadow,
                      )}
                    >
                      <Image
                        src={imageUrl}
                        alt={heading}
                        fill
                        sizes="(max-width: 640px) 100vw, 380px"
                        className="object-cover"
                      />
                    </div>
                  )}

                  {/* Copy */}
                  <div className="flex flex-col gap-5 flex-1">
                    <h2 className={cn(stripe.storyHeading, sectionHeading, 'tracking-[-0.02em]')}>
                      {heading}
                    </h2>
                    {section.bodyHtml && (
                      <div className={stripe.storyBody}>
                        <RenderHtml
                          html={section.bodyHtml}
                          className="prose-p:leading-relaxed prose-headings:text-foreground prose-a:text-accent"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TemplateSection>
          )
        }

        // ── Featured Products ───────────────────────────────────────────────────
        if (key === 'featured') {
          if (featuredProducts.length === 0) return null
          const heading = section.heading || t.store.featuredProductsHeading
          const subtext = section.subtext

          return (
            <TemplateSection
              key={key}
              aria-label={heading}
              className={cn(stripe.featuredBg, 'w-full')}
            >
              {/* 1px divider — Stripe uses these liberally */}
              <div className={cn('h-px w-full bg-border')} aria-hidden="true" />

              <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
                {/* Overline label — uppercase tracking, accent colour */}
                <div className="mb-4 flex flex-col gap-1">
                  <p
                    className={cn(
                      'text-xs font-semibold uppercase tracking-widest',
                      stripe.overlineText,
                    )}
                  >
                    {t.store.featuredProductsHeading}
                  </p>
                </div>

                <FeaturedGrid
                  products={featuredProducts}
                  heading={heading}
                  headingClassName={cn(
                    stripe.featuredText,
                    featuredHeading,
                    'tracking-[-0.02em] mb-2',
                  )}
                  wrapperClassName="flex flex-col gap-3"
                />

                {subtext && (
                  <p className={cn(stripe.featuredSub, 'mt-4 text-sm leading-relaxed max-w-lg')}>
                    {subtext}
                  </p>
                )}
              </div>
            </TemplateSection>
          )
        }

        // ── Reviews ─────────────────────────────────────────────────────────────
        if (key === 'reviews') {
          return (
            <div key={key} className={stripe.reviewsBg}>
              <ReviewsStrip section={section} />
            </div>
          )
        }

        // ── CTA Band ────────────────────────────────────────────────────────────
        if (key === 'cta') {
          const heading = section.heading || t.store.ctaDefaultHeading
          const subtext = section.subtext || t.store.ctaDefaultSubtext
          const ctaText = section.ctaText || t.store.ctaDefaultCta
          const ctaHref = section.ctaHref || '/shop'

          return (
            <TemplateSection
              key={key}
              aria-label={heading}
              className={cn(stripe.ctaBg, 'relative w-full overflow-hidden')}
            >
              {/* Subtle radial depth bloom */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,hsl(var(--primary-foreground)/0.08)_0%,transparent_70%)]"
              />

              <div className="relative mx-auto max-w-3xl px-6 py-24 sm:px-8 text-center flex flex-col items-center gap-7">
                <h2 className={cn(stripe.ctaText, sectionHeading, 'tracking-[-0.02em]')}>
                  {heading}
                </h2>

                {subtext && (
                  <p className={cn(stripe.ctaSubText, 'text-lg leading-relaxed max-w-xl')}>
                    {subtext}
                  </p>
                )}

                {/* Card/inverse button: white bg on gradient CTA — Stripe pattern */}
                <Link href={ctaHref} className={cn(inverseBtn, 'shadow-md hover:shadow-lg')}>
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
