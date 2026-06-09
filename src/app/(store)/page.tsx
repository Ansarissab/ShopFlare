import type { Metadata } from 'next'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import type { StoreConfig } from '@/lib/types/common'
import StorePageClient from './StorePageClient'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })
  return buildPageMetadata({
    title: config?.tagline ?? config?.storeName ?? 'Store',
    description: config?.tagline ?? undefined,
    canonical: `${siteUrl}/`,
    storeName: config?.storeName,
  })
}

export default function StorePage() {
  return <StorePageClient />
}
