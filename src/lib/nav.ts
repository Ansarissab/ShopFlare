import { isFeatureEnabled } from '@/lib/features'
import type { StoreConfig } from '@/lib/types/common'

/** Returns the canonical catalog URL based on whether the landing page is enabled.
 *  When the landing page is on, `/` renders the marketing page and `/shop` is the catalog.
 *  When off, `/` IS the catalog. */
export function catalogHref(landingEnabled?: boolean): string {
  return landingEnabled ? '/shop' : '/'
}

// ─── Primary nav link model ────────────────────────────────────────────────────

/** A single entry in the primary navigation bar.
 *  `labelKey` indexes into `t.store.*` so both desktop and mobile render the same
 *  strings without duplicating key names. */
export interface PrimaryNavLink {
  href: string
  /** Key of `t.store` for the link label — e.g. "shopNav", "trackOrder". */
  labelKey: 'shopNav' | 'trackOrder' | 'faqNav' | 'blogNav'
}

/**
 * Returns the ordered list of primary nav links for the storefront, given the
 * current store config. Categories are intentionally excluded (handled by the
 * CategoryNav dropdown separately). This is the single source of truth consumed
 * by both PrimaryNav (desktop) and MobileNavDrawer.
 */
export function buildPrimaryNavLinks(config: StoreConfig | null): PrimaryNavLink[] {
  const links: PrimaryNavLink[] = []

  // Shop link only when a landing page is active (so / isn't already the catalog)
  if (config?.landingEnabled) {
    links.push({ href: catalogHref(true), labelKey: 'shopNav' })
  }

  // Track Order is always visible
  links.push({ href: '/track', labelKey: 'trackOrder' })

  // Feature-flag-gated links
  if (isFeatureEnabled(config, 'faqEnabled')) {
    links.push({ href: '/faq', labelKey: 'faqNav' })
  }
  if (isFeatureEnabled(config, 'blogEnabled')) {
    links.push({ href: '/blog', labelKey: 'blogNav' })
  }

  return links
}
