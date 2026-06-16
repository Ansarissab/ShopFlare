'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import type { ImageCarouselProps } from '@/lib/types/product'

export function ImageCarousel({ images, productName, className }: ImageCarouselProps) {
  const t = useT()
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    // External-system sync: let embla events drive state. Embla emits
    // 'reInit' on initialisation, which covers the initial snap without a
    // synchronous setState in this effect.
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on('select', onSelect)
    api.on('reInit', onSelect)
    return () => {
      api.off('select', onSelect)
      api.off('reInit', onSelect)
    }
  }, [api])

  if (images.length === 0) {
    return (
      <div
        className={cn(
          'bg-muted flex aspect-square items-center justify-center rounded-xl',
          className,
        )}
      >
        <span className="text-muted-foreground text-sm">{t.product.noImage}</span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Main carousel */}
      <Carousel setApi={setApi} opts={{ loop: images.length > 1 }}>
        <CarouselContent>
          {images.map((img, idx) => (
            <CarouselItem key={img.id}>
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                <Image
                  src={img.url}
                  alt={t.store.productImageAlt
                    .replace('{productName}', productName)
                    .replace('{n}', String(idx + 1))}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  priority={idx === 0}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 && (
          <>
            <CarouselPrevious className="-inset-s-4" />
            <CarouselNext className="-inset-e-4" />
          </>
        )}
      </Carousel>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => api?.scrollTo(idx)}
              className={cn(
                'relative size-16 flex-none overflow-hidden rounded-md border-2 transition-all',
                current === idx
                  ? 'border-primary'
                  : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <Image
                src={img.url}
                alt={t.store.productThumbnailAlt
                  .replace('{productName}', productName)
                  .replace('{n}', String(idx + 1))}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
