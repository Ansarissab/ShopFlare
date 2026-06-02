'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { useApiResource } from '@/hooks/useApiResource'
import type { StorePage } from '@/lib/types/store'

function PolicySkeleton() {
  return (
    <div className={cn(layout.detailPage, 'max-w-3xl')}>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-1/4" />
      <div className="flex flex-col gap-2 mt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function PolicyPage() {
  const params = useParams<{ slug: string }>()
  const { data: page, loading, notFound } = useApiResource<StorePage>(
    params?.slug ? `/api/pages/${params.slug}` : null,
  )

  if (loading) return <PolicySkeleton />

  if (notFound || !page) {
    return (
      <div className={cn(layout.centeredState, 'max-w-3xl')}>
        <h1 className="text-xl font-semibold">{en.policies.notFound}</h1>
        <p className="text-muted-foreground text-sm">{en.policies.notFoundBody}</p>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          {en.policies.backToStore}
        </Link>
      </div>
    )
  }

  const updatedDate = new Date(page.updatedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className={cn(layout.detailPage, 'max-w-3xl')}>
      <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
      <p className="text-xs text-muted-foreground">
        {en.policies.lastUpdated.replace('{date}', updatedDate)}
      </p>

      {page.content ? (
        <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {page.content}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">{en.policies.empty}</p>
      )}

      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline w-fit">
        {en.policies.backToStore}
      </Link>
    </div>
  )
}
