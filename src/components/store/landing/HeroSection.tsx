import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getT } from '@/lib/i18n/server'
import type { HeroSectionProps } from '@/lib/types'

export async function HeroSection({
  section,
  heroStyle = 'image-left',
  imageUrl,
  storeName,
}: HeroSectionProps & { imageUrl: string | null }) {
  const t = await getT()
  // White-label: when the merchant hasn't written a custom hero heading, fall back
  // to their store name (the brand) before the generic "Welcome to Our Store" copy.
  const heading = section.heading || storeName || t.store.heroDefaultHeading
  const subtext = section.subtext || t.store.heroDefaultSubtext
  const ctaText = section.ctaText || t.store.heroDefaultCta
  const ctaHref = section.ctaHref || '/shop'

  return (
    <section
      data-hero-style={heroStyle}
      className={cn(
        'relative w-full overflow-hidden bg-background',
        heroStyle === 'full-bleed' && 'min-h-[60vh]',
      )}
      aria-label={heading}
    >
      {heroStyle === 'full-bleed' ? (
        // Full-bleed: image behind text
        <div className="relative min-h-[60vh] flex items-center justify-center text-center px-4 py-24">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={heading}
              fill
              sizes="100vw"
              className="object-cover brightness-50"
              priority
            />
          )}
          <div className="relative z-10 max-w-2xl text-white">
            <h1 className="text-4xl sm:text-5xl">{heading}</h1>
            {subtext && <p className="mt-4 text-lg opacity-90">{subtext}</p>}
            <Link
              href={ctaHref}
              className="mt-8 inline-block rounded-md bg-primary px-8 py-3 text-primary-foreground font-semibold transition hover:opacity-90"
            >
              {ctaText}
            </Link>
          </div>
        </div>
      ) : heroStyle === 'centered' ? (
        // Centered: image above text, centered layout
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          {imageUrl && (
            <div className="relative mx-auto mb-8 h-64 w-full overflow-hidden rounded-xl sm:h-80">
              <Image
                src={imageUrl}
                alt={heading}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl">{heading}</h1>
          {subtext && <p className="mt-4 text-muted-foreground text-lg">{subtext}</p>}
          <Link
            href={ctaHref}
            className="mt-8 inline-block rounded-md bg-primary px-8 py-3 text-primary-foreground font-semibold transition hover:opacity-90"
          >
            {ctaText}
          </Link>
        </div>
      ) : heroStyle === 'split' ? (
        // Split: image + text side by side (opposite sides)
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:flex-row-reverse sm:items-center sm:px-6 lg:px-8">
          {imageUrl && (
            <div className="relative h-64 w-full overflow-hidden rounded-xl sm:h-80 sm:flex-1">
              <Image
                src={imageUrl}
                alt={heading}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-4xl sm:text-5xl">{heading}</h1>
            {subtext && <p className="mt-4 text-muted-foreground text-lg">{subtext}</p>}
            <Link
              href={ctaHref}
              className="mt-8 inline-block rounded-md bg-primary px-8 py-3 text-primary-foreground font-semibold transition hover:opacity-90"
            >
              {ctaText}
            </Link>
          </div>
        </div>
      ) : (
        // image-left default → POSTER layout
        // Left-weighted poster: dominant serif headline, single sentence, one CTA.
        // Store name/brand sits as a small mono watermark above the headline.
        // If a hero image exists it anchors at the right edge, offset/bleeding.
        // Entrance animation: fade + lift, gated on prefers-reduced-motion.
        <div className="relative mx-auto flex min-h-[90svh] max-w-7xl flex-col justify-end px-4 py-16 sm:px-6 lg:px-8 lg:min-h-[85svh]">
          {/* Hero image — right-anchored, edge-crossing anchor (not a washed bg) */}
          {imageUrl && (
            <div
              className={cn(
                'pointer-events-none absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 w-full sm:w-3/5 lg:w-1/2',
              )}
              aria-hidden="true"
            >
              <Image
                src={imageUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 50vw"
                className="object-cover object-center"
                priority
              />
              {/* gradient veil: flows from text side toward image so text stays legible on mobile */}
              <div className="absolute inset-0 bg-linear-to-r rtl:bg-linear-to-l from-background via-background/80 to-transparent sm:via-background/60 sm:to-transparent" />
            </div>
          )}

          {/* Text content — left-weighted, layered above image */}
          <div
            className={cn(
              'hero-poster-text relative z-10 flex flex-col gap-6',
              imageUrl ? 'max-w-lg sm:max-w-xl' : 'max-w-2xl',
            )}
          >
            {/* Store name — mono watermark, uppercase, tracked */}
            {storeName && (
              <span className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {storeName}
              </span>
            )}

            {/* Dominant serif headline — clamp for fluid sizing */}
            <h1
              className="text-foreground tracking-tight leading-[1.05]"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}
            >
              {heading}
            </h1>

            {/* Supporting sentence — one short line, muted Geist */}
            {subtext && (
              <p className="text-base text-muted-foreground sm:text-lg max-w-sm">{subtext}</p>
            )}

            {/* Single CTA */}
            <div>
              <Link
                href={ctaHref}
                className="inline-flex items-center rounded-md bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent min-h-[44px]"
              >
                {ctaText}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
