// Integration tests for blog routes:
//   GET    /api/blog               — public list (flag-gated)
//   GET    /api/blog/:slug         — public single post (flag-gated)
//   POST   /api/admin/blog         — create post
//   GET    /api/admin/blog         — admin list
//   GET    /api/admin/blog/:id     — admin single
//   PATCH  /api/admin/blog/:id     — update post
//   DELETE /api/admin/blog/:id     — delete post
//   POST   /api/admin/blog/:id/publish   — publish
//   POST   /api/admin/blog/:id/unpublish — unpublish

import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { nanoid } from 'nanoid'

const db = () => createDb(env.DB)
const BASE = 'https://shop.test'

const get = (path: string) => SELF.fetch(`${BASE}${path}`)

const adminGet = (path: string) =>
  SELF.fetch(`${BASE}${path}`, {
    headers: { Authorization: 'Bearer test-token' },
  })

const adminPost = (path: string, body?: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

const adminPatch = (path: string, body: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
    body: JSON.stringify(body),
  })

const adminDelete = (path: string) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer test-token' },
  })

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const TABLES = [
  'coupon_uses', 'reviews', 'notify_me', 'order_items', 'orders', 'coupons',
  'size_options', 'product_images', 'variants', 'products', 'store_config',
  'stripe_events', 'push_subscriptions', 'analytics_daily', 'carts', 'blog_posts',
]
beforeEach(async () => {
  for (const t of TABLES) await env.DB.prepare(`DELETE FROM ${t}`).run()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const setBlogEnabled = async (value: boolean) => {
  const now = new Date().toISOString()
  await db().insert(schema.storeConfig).values({
    key: 'blogEnabled',
    value: String(value),
    updatedAt: now,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Public blog routes — flag off', () => {
  it('GET /api/blog returns 404 when blogEnabled=false (default, no store_config row)', async () => {
    const res = await get('/api/blog')
    expect(res.status).toBe(404)
  })

  it('GET /api/blog/some-slug returns 404 when blogEnabled=false', async () => {
    const res = await get('/api/blog/some-slug')
    expect(res.status).toBe(404)
  })
})

describe('Public blog routes — flag on, no posts', () => {
  it('GET /api/blog returns 200 with empty list after enabling blog', async () => {
    await setBlogEnabled(true)
    const res = await get('/api/blog')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { posts: unknown[]; nextCursor: unknown }
    expect(body.posts).toEqual([])
    expect(body.nextCursor).toBeNull()
  })
})

describe('Admin blog CRUD (dev bypass)', () => {
  // 401-without-Bearer is covered by the requireAdmin unit tests in
  // worker/lib/access.test.ts. In the integration env ADMIN_DEV_BYPASS=1
  // skips auth, so testing 401 here would be a false negative.

  it('POST /api/admin/blog creates a post, returns 201 with id + slug', async () => {
    const res = await adminPost('/api/admin/blog', {
      slug: 'hello-world',
      title: 'Hello World',
      bodyHtml: '<p>Hello</p>',
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('slug', 'hello-world')
  })

  it('GET /api/admin/blog lists the created post', async () => {
    await adminPost('/api/admin/blog', {
      slug: 'list-me',
      title: 'List Me',
    })
    const res = await adminGet('/api/admin/blog')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { posts: Array<Record<string, unknown>> }
    expect(body.posts.length).toBeGreaterThanOrEqual(1)
    expect(body.posts.some((p) => p.slug === 'list-me')).toBe(true)
  })

  it('GET /api/admin/blog/:id returns the post', async () => {
    const createRes = await adminPost('/api/admin/blog', {
      slug: 'fetch-by-id',
      title: 'Fetch By Id',
    })
    const { id } = (await createRes.json()) as { id: string }

    const res = await adminGet(`/api/admin/blog/${id}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.id).toBe(id)
    expect(body.slug).toBe('fetch-by-id')
  })

  it('PATCH /api/admin/blog/:id updates title, returns ok', async () => {
    const createRes = await adminPost('/api/admin/blog', {
      slug: 'patch-me',
      title: 'Original Title',
    })
    const { id } = (await createRes.json()) as { id: string }

    const res = await adminPatch(`/api/admin/blog/${id}`, { title: 'Updated Title' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)

    const getRes = await adminGet(`/api/admin/blog/${id}`)
    const post = (await getRes.json()) as Record<string, unknown>
    expect(post.title).toBe('Updated Title')
  })

  it('DELETE /api/admin/blog/:id removes the post; subsequent GET returns 404', async () => {
    const createRes = await adminPost('/api/admin/blog', {
      slug: 'delete-me',
      title: 'Delete Me',
    })
    const { id } = (await createRes.json()) as { id: string }

    const delRes = await adminDelete(`/api/admin/blog/${id}`)
    expect(delRes.status).toBe(200)

    const getRes = await adminGet(`/api/admin/blog/${id}`)
    expect(getRes.status).toBe(404)
  })

  it('POST /api/admin/blog/:id/publish sets status to published, stamps publishedAt', async () => {
    const createRes = await adminPost('/api/admin/blog', {
      slug: 'publish-me',
      title: 'Publish Me',
    })
    const { id } = (await createRes.json()) as { id: string }

    const pubRes = await adminPost(`/api/admin/blog/${id}/publish`)
    expect(pubRes.status).toBe(200)

    const getRes = await adminGet(`/api/admin/blog/${id}`)
    const post = (await getRes.json()) as Record<string, unknown>
    expect(post.status).toBe('published')
    expect(post.publishedAt).toBeTruthy()
  })

  it('POST /api/admin/blog/:id/unpublish sets status back to draft', async () => {
    const createRes = await adminPost('/api/admin/blog', {
      slug: 'unpublish-me',
      title: 'Unpublish Me',
    })
    const { id } = (await createRes.json()) as { id: string }

    await adminPost(`/api/admin/blog/${id}/publish`)
    const unpubRes = await adminPost(`/api/admin/blog/${id}/unpublish`)
    expect(unpubRes.status).toBe(200)

    const getRes = await adminGet(`/api/admin/blog/${id}`)
    const post = (await getRes.json()) as Record<string, unknown>
    expect(post.status).toBe('draft')
  })

  it('Slug collision: second POST with same slug returns 409', async () => {
    await adminPost('/api/admin/blog', { slug: 'clash-slug', title: 'First' })
    const res = await adminPost('/api/admin/blog', { slug: 'clash-slug', title: 'Second' })
    expect(res.status).toBe(409)
  })
})

describe('Draft visibility — draft never leaks on public routes', () => {
  it('public list does not include a draft post', async () => {
    await setBlogEnabled(true)
    await adminPost('/api/admin/blog', {
      slug: 'secret-draft',
      title: 'Secret Draft',
      status: 'draft',
    })

    const res = await get('/api/blog')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { posts: Array<Record<string, unknown>> }
    expect(body.posts.some((p) => p.slug === 'secret-draft')).toBe(false)
  })

  it('GET /api/blog/:slug for a draft slug returns 404', async () => {
    await setBlogEnabled(true)
    await adminPost('/api/admin/blog', {
      slug: 'hidden-draft',
      title: 'Hidden Draft',
      status: 'draft',
    })

    const res = await get('/api/blog/hidden-draft')
    expect(res.status).toBe(404)
  })

  it('published post appears in public list', async () => {
    await setBlogEnabled(true)
    const createRes = await adminPost('/api/admin/blog', {
      slug: 'soon-published',
      title: 'Soon Published',
    })
    const { id } = (await createRes.json()) as { id: string }
    await adminPost(`/api/admin/blog/${id}/publish`)

    const res = await get('/api/blog')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { posts: Array<Record<string, unknown>> }
    expect(body.posts.some((p) => p.slug === 'soon-published')).toBe(true)
  })

  it('GET /api/blog/:slug returns 200 after publishing', async () => {
    await setBlogEnabled(true)
    const createRes = await adminPost('/api/admin/blog', {
      slug: 'now-public',
      title: 'Now Public',
    })
    const { id } = (await createRes.json()) as { id: string }
    await adminPost(`/api/admin/blog/${id}/publish`)

    const res = await get('/api/blog/now-public')
    expect(res.status).toBe(200)
  })
})

describe('Slug uniqueness', () => {
  it('two posts with same slug — second POST returns 409', async () => {
    await adminPost('/api/admin/blog', { slug: 'unique-slug', title: 'First Post' })
    const res = await adminPost('/api/admin/blog', { slug: 'unique-slug', title: 'Second Post' })
    expect(res.status).toBe(409)
  })

  it('PATCH with a slug already taken by another post returns 409', async () => {
    await adminPost('/api/admin/blog', { slug: 'taken-slug', title: 'Owner' })
    const createRes = await adminPost('/api/admin/blog', {
      slug: 'other-slug',
      title: 'Other Post',
    })
    const { id } = (await createRes.json()) as { id: string }

    const res = await adminPatch(`/api/admin/blog/${id}`, { slug: 'taken-slug' })
    expect(res.status).toBe(409)
  })
})
