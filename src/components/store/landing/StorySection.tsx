'use client'

import Image from 'next/image'
import { RenderHtml } from '@/components/shared/RenderHtml'
import { useReveal } from '@/hooks/useReveal'
import { layout } from '@/lib/styles'
import type { StorySectionProps } from '@/lib/types'

export function StorySection({
  section,
  imageUrl,
  t,
}: StorySectionProps & { imageUrl: string | null }) {
  const heading = section.heading || t.store.storyDefaultHeading
  const ref = useReveal<HTMLElement>()

  return (
    <section ref={ref} className={layout.landingSection} aria-label={heading}>
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-12">
        {imageUrl && (
          <div className="relative h-64 w-full overflow-hidden rounded-xl sm:h-80 sm:w-2/5 flex-shrink-0">
            <Image
              src={imageUrl}
              alt={t.store.storyImageAlt}
              fill
              sizes="(max-width: 640px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-3xl">{heading}</h2>
          {section.bodyHtml && (
            <div className="mt-4 prose prose-neutral dark:prose-invert max-w-none">
              <RenderHtml html={section.bodyHtml} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
