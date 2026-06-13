'use client'

import { Catalog } from '@/components/store/Catalog'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'

interface StorePageClientProps {
  /** SSR-seeded product list passed from the RSC page to eliminate first-paint skeleton. */
  initialProducts?: ProductWithVariants[]
  /** SSR-seeded category list — eliminates server/client mismatch in Catalog. */
  initialCategories?: CategoryNode[]
}

// Flag OFF: home '/' renders the catalog at basePath '/'.
// When landingEnabled is ON, this component is no longer rendered at '/';
// the SSR page.tsx renders LandingPage instead and this file only stays
// as a reference for the flag-off path.
export default function StorePageClient({
  initialProducts,
  initialCategories,
}: StorePageClientProps) {
  return (
    <Catalog basePath="/" initialProducts={initialProducts} initialCategories={initialCategories} />
  )
}
