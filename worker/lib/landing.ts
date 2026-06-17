// Shared landing-page helpers used by both public + admin routes.

import { asc } from 'drizzle-orm'
import * as schema from 'worker/db/schema'
import type { LandingPage } from 'worker/db/schema'
import type { Database } from 'worker/db/index'

/**
 * Returns the full active landing page row.
 * Fallback order:
 *   1. The page with isActive = true
 *   2. The first page ordered by sortOrder, then id (if none is active)
 *   3. null when there are no pages at all
 */
export async function resolveActivePage(db: Database): Promise<LandingPage | null> {
  const pages = await db
    .select()
    .from(schema.landingPages)
    .orderBy(asc(schema.landingPages.sortOrder), asc(schema.landingPages.id))
    .all()

  if (pages.length === 0) return null

  const active = pages.find((p) => p.isActive)
  return active ?? pages[0]
}

/**
 * Returns the id of the active landing page.
 * Delegates to resolveActivePage — single query, single source of truth.
 */
export async function resolveActivePageId(db: Database): Promise<string | null> {
  const page = await resolveActivePage(db)
  return page ? page.id : null
}
