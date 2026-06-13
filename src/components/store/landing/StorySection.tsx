import Image from 'next/image'
import { RenderHtml } from '@/components/shared/RenderHtml'
import { getT } from '@/lib/i18n/server'
import type { StorySectionProps } from '@/lib/types'

export async function StorySection({
  section,
  imageUrl,
}: StorySectionProps & { imageUrl: string | null }) {
  const t = await getT()
  const heading = section.heading || t.store.storyDefaultHeading

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-label={heading}>
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-12">
        {imageUrl && (
          <div className="relative h-64 w-full overflow-hidden rounded-xl sm:h-80 sm:w-2/5 flex-shrink-0">
            <Image src={imageUrl} alt={heading} fill className="object-cover" />
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-3xl font-bold">{heading}</h2>
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
