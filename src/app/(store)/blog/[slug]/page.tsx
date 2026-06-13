import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { JsonLd } from '@/components/shared/JsonLd'
import { RenderHtml } from '@/components/shared/RenderHtml'
import { layout } from '@/lib/styles'
import { getT } from '@/lib/i18n/server'
import { fetchFromWorker, r2Url } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { articleJsonLd, breadcrumbListJsonLd } from '@/lib/seo/jsonld'
import type { BlogPost } from '@/lib/types/blog'
import type { StoreConfig } from '@/lib/types/common'

export const revalidate = 60

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getT()
  const { slug } = await params
  const [post, config] = await Promise.all([
    fetchFromWorker<BlogPost>(`/api/blog/${slug}`, { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!post) return { title: t.blog.pageTitle }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const coverUrl = r2Url(post.coverR2Key)

  return buildPageMetadata({
    title: post.title,
    description: post.excerpt || undefined,
    canonical: `${siteUrl}/blog/${slug}`,
    imageUrl: coverUrl ?? undefined,
    storeName: config?.storeName,
  })
}

export default async function BlogPostPage({ params }: PageProps) {
  const t = await getT()
  const { slug } = await params
  const [post, config] = await Promise.all([
    fetchFromWorker<BlogPost>(`/api/blog/${slug}`, { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!post) notFound()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const postUrl = `${siteUrl}/blog/${slug}`
  const coverUrl = r2Url(post.coverR2Key)

  const article = articleJsonLd({
    title: post.title,
    description: post.excerpt || undefined,
    url: postUrl,
    imageUrl: coverUrl ?? undefined,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
  })

  const breadcrumb = breadcrumbListJsonLd([
    { name: config?.storeName ?? 'Home', url: siteUrl || '/' },
    { name: t.blog.breadcrumbBlog, url: `${siteUrl}/blog` },
    { name: post.title, url: null },
  ])

  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className={layout.page}>
      <JsonLd data={article} />
      <JsonLd data={breadcrumb} />

      <article className="mx-auto w-full max-w-3xl px-4 py-10">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link href="/" className="hover:underline">
            {config?.storeName ?? 'Home'}
          </Link>
          <span aria-hidden>/</span>
          <Link href="/blog" className="hover:underline">
            {t.blog.breadcrumbBlog}
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate max-w-[20ch]">{post.title}</span>
        </nav>

        {/* Cover */}
        {coverUrl && (
          <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-xl">
            <Image
              src={coverUrl}
              alt={post.coverAlt ?? post.title}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 768px) 768px, 100vw"
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">{post.title}</h1>
          {publishedDate && (
            <time dateTime={post.publishedAt ?? ''} className="text-sm text-muted-foreground">
              {t.blog.publishedOn.replace('{date}', publishedDate)}
            </time>
          )}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Body */}
        <RenderHtml html={post.bodyHtml} className="prose prose-sm sm:prose max-w-none" />
      </article>
    </div>
  )
}
