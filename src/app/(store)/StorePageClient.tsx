'use client'

import { Catalog } from '@/components/store/Catalog'

// Flag OFF: home '/' renders the catalog at basePath '/'.
// When landingEnabled is ON, this component is no longer rendered at '/';
// the SSR page.tsx renders LandingPage instead and this file only stays
// as a reference for the flag-off path.
export default function StorePageClient() {
  return <Catalog basePath="/" />
}
