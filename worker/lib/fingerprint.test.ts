import { describe, it, expect } from 'vitest'
import { etagFor } from 'worker/lib/fingerprint'

describe('etagFor', () => {
  it('returns a weak ETag string', () => {
    const etag = etagFor({ count: 5, maxUpdatedAt: '2024-01-01T00:00:00Z' })
    expect(etag).toMatch(/^W\/"[A-Za-z0-9+/=]+"$/)
  })

  it('ETag changes when count changes', () => {
    const a = etagFor({ count: 5, maxUpdatedAt: '2024-01-01T00:00:00Z' })
    const b = etagFor({ count: 6, maxUpdatedAt: '2024-01-01T00:00:00Z' })
    expect(a).not.toBe(b)
  })

  it('ETag changes when maxUpdatedAt changes', () => {
    const a = etagFor({ count: 5, maxUpdatedAt: '2024-01-01T00:00:00Z' })
    const b = etagFor({ count: 5, maxUpdatedAt: '2024-06-01T00:00:00Z' })
    expect(a).not.toBe(b)
  })

  it('ETag changes when version changes', () => {
    const a = etagFor({ count: 5, maxUpdatedAt: '2024-01-01T00:00:00Z', version: 1 })
    const b = etagFor({ count: 5, maxUpdatedAt: '2024-01-01T00:00:00Z', version: 2 })
    expect(a).not.toBe(b)
  })

  it('same inputs produce same ETag (deterministic)', () => {
    const input = { count: 10, maxUpdatedAt: '2024-03-15T12:00:00Z', version: 42 }
    expect(etagFor(input)).toBe(etagFor(input))
  })

  it('version is optional — absent and undefined produce same ETag', () => {
    const withUndefined = etagFor({
      count: 3,
      maxUpdatedAt: '2024-01-01T00:00:00Z',
      version: undefined,
    })
    const withoutVersion = etagFor({ count: 3, maxUpdatedAt: '2024-01-01T00:00:00Z' })
    expect(withUndefined).toBe(withoutVersion)
  })

  it('encodes raw string as base64 inside the ETag', () => {
    const input = { count: 1, maxUpdatedAt: '2024-01-01T00:00:00Z', version: 'v7' }
    const etag = etagFor(input)
    // strip W/"..." wrapper and decode
    const inner = etag.slice(3, -1)
    const decoded = Buffer.from(inner, 'base64').toString('utf8')
    expect(decoded).toBe('1:2024-01-01T00:00:00Z:v7')
  })

  it('handles zero count', () => {
    const etag = etagFor({ count: 0, maxUpdatedAt: '' })
    expect(etag.startsWith('W/"')).toBe(true)
  })

  it('handles numeric version', () => {
    const etag = etagFor({ count: 2, maxUpdatedAt: '2024-01-01T00:00:00Z', version: 99 })
    const inner = etag.slice(3, -1)
    const decoded = Buffer.from(inner, 'base64').toString('utf8')
    expect(decoded).toContain(':99')
  })
})
