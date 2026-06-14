import Link from 'next/link'
import type { CTABandProps } from '@/lib/types'

export function CTABand({ section, t }: CTABandProps) {
  const heading = section.heading || t.store.ctaDefaultHeading
  const subtext = section.subtext || t.store.ctaDefaultSubtext
  const ctaText = section.ctaText || t.store.ctaDefaultCta
  const ctaHref = section.ctaHref || '/shop'

  return (
    <section className="bg-primary py-16 text-center" aria-label={heading}>
      <div className="mx-auto max-w-2xl px-4">
        <h2 className="text-3xl font-bold text-primary-foreground">{heading}</h2>
        {subtext && <p className="mt-4 text-primary-foreground/80 text-lg">{subtext}</p>}
        <Link
          href={ctaHref}
          className="mt-8 inline-block rounded-md bg-primary-foreground px-10 py-3 text-primary font-semibold transition hover:opacity-90"
        >
          {ctaText}
        </Link>
      </div>
    </section>
  )
}
