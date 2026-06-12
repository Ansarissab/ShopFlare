import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import type { HeroSectionProps } from '@/lib/types'

export function HeroSection({
  section,
  heroStyle = 'image-left',
  imageUrl,
  storeName,
}: HeroSectionProps & { imageUrl: string | null }) {
  // White-label: when the merchant hasn't written a custom hero heading, fall back
  // to their store name (the brand) before the generic "Welcome to Our Store" copy.
  const heading = section.heading || storeName || en.store.heroDefaultHeading
  const subtext = section.subtext || en.store.heroDefaultSubtext
  const ctaText = section.ctaText || en.store.heroDefaultCta
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
              className="object-cover brightness-50"
              priority
            />
          )}
          <div className="relative z-10 max-w-2xl text-white">
            <h1 className="text-4xl font-bold sm:text-5xl">{heading}</h1>
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
              <Image src={imageUrl} alt={heading} fill className="object-cover" priority />
            </div>
          )}
          <h1 className="text-4xl font-bold sm:text-5xl">{heading}</h1>
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
              <Image src={imageUrl} alt={heading} fill className="object-cover" priority />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-4xl font-bold sm:text-5xl">{heading}</h1>
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
        // image-left (default)
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          {imageUrl && (
            <div className="relative h-64 w-full overflow-hidden rounded-xl sm:h-80 sm:flex-1">
              <Image src={imageUrl} alt={heading} fill className="object-cover" priority />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-4xl font-bold sm:text-5xl">{heading}</h1>
            {subtext && <p className="mt-4 text-muted-foreground text-lg">{subtext}</p>}
            <Link
              href={ctaHref}
              className="mt-8 inline-block rounded-md bg-primary px-8 py-3 text-primary-foreground font-semibold transition hover:opacity-90"
            >
              {ctaText}
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
