import type { CategoryNode } from './category'

// ─── Component prop interfaces (DRY rule 3 — all *Props live in lib/types) ────

/** Props for the desktop primary links bar. */
export interface PrimaryNavProps {
  /** Ordered nav links produced by buildPrimaryNavLinks(). */
  links: import('@/lib/nav').PrimaryNavLink[]
}

/** Props for the mobile hamburger + drawer. */
export interface MobileNavDrawerProps {
  /** Primary nav links computed once in StorefrontHeader — no re-derive needed. */
  links: import('@/lib/nav').PrimaryNavLink[]
  /** Category tree passed down from the parent header (already fetched). */
  categories: CategoryNode[]
}
