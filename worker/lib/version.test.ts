import { describe, it, expect, vi, afterEach } from 'vitest'
import { bumpDataVersion, getDataVersion } from 'worker/lib/version'
import type { Database } from 'worker/db/index'

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * Builds a fake Drizzle db whose `select().from().where().get()` resolves to
 * `selectRow`, and whose `insert().values().onConflictDoUpdate()` resolves.
 * Returns the db plus spies so callers can assert what was written.
 */
function makeDb(selectRow: { value: string } | undefined) {
  const get = vi.fn().mockResolvedValue(selectRow)
  const where = vi.fn(() => ({ get }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))

  const onConflictDoUpdate = vi.fn((..._a: unknown[]) => Promise.resolve(undefined))
  const values = vi.fn((..._a: unknown[]) => ({ onConflictDoUpdate }))
  const insert = vi.fn(() => ({ values }))

  const db = { select, insert } as unknown as Database
  return { db, select, insert, values, onConflictDoUpdate, get }
}

describe('getDataVersion', () => {
  it('returns the stored version value', async () => {
    const { db } = makeDb({ value: '42' })
    expect(await getDataVersion(db)).toBe('42')
  })

  it('returns "0" when no row exists', async () => {
    const { db } = makeDb(undefined)
    expect(await getDataVersion(db)).toBe('0')
  })
})

describe('bumpDataVersion', () => {
  it('inserts seed value "1" (first-ever write)', async () => {
    const { db, values } = makeDb(undefined)
    await bumpDataVersion(db)

    expect(values).toHaveBeenCalledTimes(1)
    const written = values.mock.calls[0][0] as { key: string; value: string }
    expect(written.key).toBe('dataVersion')
    expect(written.value).toBe('1')
  })

  it('uses a SQL expression (not a precomputed string) for the conflict increment', async () => {
    const { db, onConflictDoUpdate } = makeDb({ value: '7' })
    await bumpDataVersion(db)

    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1)
    const conflict = onConflictDoUpdate.mock.calls[0][0] as { set: { value: unknown } }
    // The increment must be a Drizzle SQL template object, not a pre-computed string.
    // True atomicity is verified by the integration suite; here we just guard the shape.
    expect(typeof conflict.set.value).not.toBe('string')
    expect(conflict.set.value).toBeTruthy()
  })

  it('writes an ISO updatedAt timestamp', async () => {
    const { db, values } = makeDb(undefined)
    await bumpDataVersion(db)
    const written = values.mock.calls[0][0] as { updatedAt: string }
    expect(written.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('does NOT perform a read before the upsert (single atomic statement)', async () => {
    const { db, select } = makeDb({ value: '5' })
    await bumpDataVersion(db)
    // The atomic rewrite must never call select — atomicity means no pre-read.
    expect(select).not.toHaveBeenCalled()
  })
})
