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
import type { ImageCarouselProps } from '@/lib/types/product'

export function ImageCarousel({ images, className }: ImageCarouselProps) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    api.on('select', () => setCurrent(api.selectedScrollSnap()))
  }, [api])

  if (images.length === 0) {
    return (
      <div
        className={cn(
          'bg-muted flex aspect-square items-center justify-center rounded-xl',
          className,
        )}
      >
        <span className="text-muted-foreground text-sm">No image</span>
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
                  alt={`Product image ${idx + 1}`}
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
            <CarouselPrevious className="-left-4" />
            <CarouselNext className="-right-4" />
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
                alt={`Thumbnail ${idx + 1}`}
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
