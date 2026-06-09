import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { RenderHtml } from '@/components/shared/RenderHtml'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/index'
import { en } from '@/lib/i18n/en'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/shared/JsonLd'
import { breadcrumbListJsonLd } from '@/lib/seo/jsonld'
import type { StorePage } from '@/lib/types/admin'
import type { StoreConfig } from '@/lib/types/common'

interface PageProps {
  params: Promise<{ slug: string }>
}

const plainText = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const [page, config] = await Promise.all([
    fetchFromWorker<StorePage>(`/api/pages/${slug}`, { revalidate: 300 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!page) return { title: en.policies.notFound }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  return buildPageMetadata({
    title: page.title,
    description: page.content ? plainText(page.content) : undefined,
    canonical: `${siteUrl}/policy/${slug}`,
    storeName: config?.storeName,
  })
}

export default async function PolicyPage({ params }: PageProps) {
  const { slug } = await params
  const [page, config] = await Promise.all([
    fetchFromWorker<StorePage>(`/api/pages/${slug}`, { revalidate: 300 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!page) notFound()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const breadcrumb = breadcrumbListJsonLd([
    { name: config?.storeName ?? 'Home', url: `${siteUrl}/` },
    { name: page.title, url: `${siteUrl}/policy/${slug}` },
  ])
  const webPage: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    url: `${siteUrl}/policy/${slug}`,
    ...(page.updatedAt ? { dateModified: page.updatedAt } : {}),
  }

  const updatedDate = formatDate(
    page.updatedAt,
    { year: 'numeric', month: 'long', day: 'numeric' },
    undefined,
  )

  // Detect whether content is plain text or HTML (Trix output starts with <).
  const isHtml = page.content?.trimStart().startsWith('<')

  return (
    <div className={cn(layout.detailPage, 'max-w-3xl')}>
      <JsonLd data={breadcrumb} />
      <JsonLd data={webPage} />
      <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
      <p className="text-xs text-muted-foreground">
        {en.policies.lastUpdated.replace('{date}', updatedDate)}
      </p>

      {page.content ? (
        isHtml ? (
          <RenderHtml html={page.content} />
        ) : (
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {page.content}
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground italic">{en.policies.empty}</p>
      )}

      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline w-fit">
        {en.policies.backToStore}
      </Link>
    </div>
  )
}
