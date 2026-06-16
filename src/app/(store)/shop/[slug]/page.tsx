import { permanentRedirect } from 'next/navigation'
import { buildCategoryHref } from '@/lib/nav'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * /shop/<slug> → permanent (308) redirect to /category/<slug>.
 *
 * Landing-page CTAs historically linked to /shop/<category-slug>, but the
 * canonical category route lives at /category/<slug>. This segment catches
 * those URLs and redirects so no CTA ever 404s, keeping /category/<slug>
 * as the single canonical URL.
 */
export default async function ShopSlugRedirectPage({ params }: PageProps) {
  const { slug } = await params
  permanentRedirect(buildCategoryHref(slug))
}
