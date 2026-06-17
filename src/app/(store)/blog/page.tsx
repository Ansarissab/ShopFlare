import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { JsonLd } from '@/components/shared/JsonLd'
import { layout } from '@/lib/styles'
import { getT } from '@/lib/i18n/server'
import { fetchFromWorker, r2Url } from '@/lib/server/fetchFromWorker'
import { serverWorkerUrl } from '@/lib/server/worker-origin'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { breadcrumbListJsonLd } from '@/lib/seo/jsonld'
import type { BlogListResponse } from '@/lib/types/blog'
import type { StoreConfig } from '@/lib/types/common'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })
  return {
    ...buildPageMetadata({
      title: t.blog.pageTitle,
      description: t.blog.pageDescription,
      canonical: `${siteUrl}/blog`,
      storeName: config?.storeName,
    }),
    alternates: {
      canonical: `${siteUrl}/blog`,
      types: { 'application/rss+xml': `${siteUrl}/blog/rss.xml` },
    },
  }
}

export default async function BlogIndexPage() {
  const t = await getT()
  const [data, config] = await Promise.all([
    fetchFromWorker<BlogListResponse>('/api/blog', { revalidate: 60 }),
    fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 }),
  ])

  if (!data) notFound()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const workerUrl = serverWorkerUrl()
  const { posts } = data

  const breadcrumb = breadcrumbListJsonLd([
    { name: config?.storeName ?? 'Home', url: siteUrl || '/' },
    { name: t.blog.pageTitle, url: null },
  ])

  return (
    <div className={layout.page}>
      <JsonLd data={breadcrumb} />

      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-8">{t.blog.pageTitle}</h1>

        {posts.length === 0 ? (
          <p className="text-muted-foreground text-center py-16">{t.blog.noPosts}</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const coverUrl = post.coverR2Key
                ? (r2Url(post.coverR2Key) ?? `${workerUrl}/cdn/${post.coverR2Key}`)
                : null
              return (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-3 rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
                >
                  {coverUrl && (
                    <div className="relative aspect-video overflow-hidden">
                      <Image
                        src={coverUrl}
                        alt={post.coverAlt ?? post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 p-4">
                    <h2 className="font-semibold text-base leading-snug group-hover:underline line-clamp-2">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      {post.publishedAt && (
                        <time dateTime={post.publishedAt} className="text-xs text-muted-foreground">
                          {t.blog.publishedOn.replace(
                            '{date}',
                            new Date(post.publishedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }),
                          )}
                        </time>
                      )}
                      <span className="text-xs font-medium text-primary ms-auto">
                        {t.blog.readMore} →
                      </span>
                    </div>
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
