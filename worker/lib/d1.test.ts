import { describe, it, expect } from 'vitest'
import { rowsChanged } from 'worker/lib/d1'

describe('rowsChanged', () => {
  it('reads meta.changes when present', () => {
    expect(rowsChanged({ meta: { changes: 1 } })).toBe(1)
    expect(rowsChanged({ meta: { changes: 0 } })).toBe(0)
    expect(rowsChanged({ meta: { changes: 3 } })).toBe(3)
  })

  it('returns 0 when meta or changes is missing', () => {
    expect(rowsChanged({})).toBe(0)
    expect(rowsChanged({ meta: {} })).toBe(0)
    expect(rowsChanged(undefined)).toBe(0)
    expect(rowsChanged(null)).toBe(0)
  })
})
