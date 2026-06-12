// Global data version stamp — incremented by every admin write so that
// public endpoint ETags incorporate deletes and multi-table mutations that
// would otherwise leave max(updated_at) unchanged.

import { eq, sql } from 'drizzle-orm'
import type { Database } from 'worker/db/index'
import { storeConfig } from 'worker/db/schema'

const VERSION_KEY = 'dataVersion'

export async function bumpDataVersion(db: Database): Promise<void> {
  // Single atomic upsert: INSERT seed '1', on conflict increment the existing
  // integer value in-place. Eliminates the prior read-then-write race where two
  // concurrent admin writes both read N and write N+1 (a lost increment).
  const now = new Date().toISOString()

  await db
    .insert(storeConfig)
    .values({ key: VERSION_KEY, value: '1', updatedAt: now })
    .onConflictDoUpdate({
      target: storeConfig.key,
      set: {
        value: sql`CAST(${storeConfig.value} AS INTEGER) + 1`,
        updatedAt: now,
      },
    })
}

export async function getDataVersion(db: Database): Promise<string> {
  const row = await db
    .select({ value: storeConfig.value })
    .from(storeConfig)
    .where(eq(storeConfig.key, VERSION_KEY))
    .get()
  return row?.value ?? '0'
}
