// Global data version stamp — incremented by every admin write so that
// public endpoint ETags incorporate deletes and multi-table mutations that
// would otherwise leave max(updated_at) unchanged.

import { eq } from 'drizzle-orm'
import type { Database } from 'worker/db/index'
import { storeConfig } from 'worker/db/schema'

const VERSION_KEY = 'dataVersion'

export async function bumpDataVersion(db: Database): Promise<void> {
  const row = await db
    .select({ value: storeConfig.value })
    .from(storeConfig)
    .where(eq(storeConfig.key, VERSION_KEY))
    .get()

  const next = String((Number(row?.value ?? '0') || 0) + 1)
  const now = new Date().toISOString()

  await db
    .insert(storeConfig)
    .values({ key: VERSION_KEY, value: next, updatedAt: now })
    .onConflictDoUpdate({
      target: storeConfig.key,
      set: { value: next, updatedAt: now },
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
