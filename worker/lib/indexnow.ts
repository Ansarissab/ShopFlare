// IndexNow auto-ping — CF-native, $0, fire-and-forget via waitUntil.
// Notifies Bing/IndexNow-compatible engines when products change so they
// re-crawl fast. Key is merchant-configured, stored in D1 (Dynamic-First).
// Feature is off (no-op) when indexNowKey is empty/missing in store_config.

import { eq } from 'drizzle-orm'
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY_PATH } from '@/lib/constants'
import type { Bindings } from 'worker/types'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'

/**
 * Fire-and-forget IndexNow ping for the given URL paths.
 * Reads `indexNowKey` from D1 store_config; returns immediately (no-op) if
 * key is empty or missing. Network errors are swallowed — a failed ping must
 * never fail the calling product mutation.
 *
 * @param db   - Drizzle Database instance
 * @param env  - CF Worker Bindings (needs FRONTEND_URL)
 * @param paths - Store-relative paths to ping, e.g. ['/product/abc123']
 */
export async function pingIndexNow(db: Database, env: Bindings, paths: string[]): Promise<void> {
  // Read indexNowKey from D1 store_config by key.
  const row = await db
    .select({ value: schema.storeConfig.value })
    .from(schema.storeConfig)
    .where(eq(schema.storeConfig.key, 'indexNowKey'))
    .get()

  const indexNowKey = row?.value ?? ''
  if (!indexNowKey) return // feature off — merchant hasn't set a key

  const frontendUrl = env.FRONTEND_URL.replace(/\/$/, '')
  const host = new URL(frontendUrl).hostname

  const payload = {
    host,
    key: indexNowKey,
    keyLocation: `${frontendUrl}${INDEXNOW_KEY_PATH}`,
    urlList: paths.map((p) => `${frontendUrl}${p}`),
  }

  try {
    await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    // Swallow network errors — ping failure must never surface to the admin.
    console.error('[indexnow] ping failed', err)
  }
}
