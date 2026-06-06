import { describe, it, expect } from 'vitest'
import { parseBody } from 'worker/lib/http'

describe('parseBody', () => {
  it('returns [data, null] when JSON is valid', async () => {
    const payload = { name: 'test', value: 42 }
    const ctx = {
      req: {
        json: async () => payload,
      },
    }
    const [data, err] = await parseBody(ctx)
    expect(err).toBeNull()
    expect(data).toEqual(payload)
  })

  it('returns [null, 400 Response] when JSON throws', async () => {
    const ctx = {
      req: {
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      },
    }
    const [data, err] = await parseBody(ctx)
    expect(data).toBeNull()
    expect(err).toBeInstanceOf(Response)
    expect((err as Response).status).toBe(400)
  })

  it('error response has application/json content-type', async () => {
    const ctx = {
      req: {
        json: async () => {
          throw new Error('bad json')
        },
      },
    }
    const [, err] = await parseBody(ctx)
    expect((err as Response).headers.get('Content-Type')).toBe('application/json')
  })

  it('error response body contains error field', async () => {
    const ctx = {
      req: {
        json: async () => {
          throw new Error('bad json')
        },
      },
    }
    const [, err] = await parseBody(ctx)
    const body = await (err as Response).json()
    expect(body).toHaveProperty('error')
    expect((body as { error: string }).error).toBe('Invalid JSON')
  })

  it('handles null return from json()', async () => {
    const ctx = {
      req: {
        json: async () => null,
      },
    }
    const [data, err] = await parseBody(ctx)
    expect(err).toBeNull()
    expect(data).toBeNull()
  })

  it('handles array return from json()', async () => {
    const ctx = {
      req: {
        json: async () => [1, 2, 3],
      },
    }
    const [data, err] = await parseBody(ctx)
    expect(err).toBeNull()
    expect(data).toEqual([1, 2, 3])
  })
})
