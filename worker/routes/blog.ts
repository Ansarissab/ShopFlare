// Public blog routes — mounted at /api/blog.
// All routes check blogEnabled server-side first: flag off → 404 (not empty 200).
// Drafts are never returned on public routes, even by direct slug.

import { Hono } from 'hono'
import { eq, desc, and, lt, or } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { isFeatureEnabled } from 'worker/lib/features'
import { etagFor } from 'worker/lib/fingerprint'
import { getDataVersion } from 'worker/lib/version'
import { edgeCached } from 'worker/lib/edge-cache'
import type { Bindings } from 'worker/types'

const PAGE_SIZE = 12

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function getBlogEnabled(db: ReturnType<typeof createDb>): Promise<boolean> {
  const configRows = await db.select().from(schema.storeConfig).all()
  const kv = Object.fromEntries(configRows.map(r => [r.key, r.value]))
  const raw = kv['blogEnabled']
  return raw !== undefined ? raw === 'true' : false
}

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET / — published posts, paginated (cursor on publishedAt + id) ──────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)

  if (!isFeatureEnabled({ blogEnabled: await getBlogEnabled(db) }, 'blogEnabled')) {
    return c.notFound()
  }

  const cursorParam = c.req.query('cursor') ?? null
  // cursor encodes "publishedAt|id" of the last item seen
  let cursorDate: string | null = null
  let cursorId: string | null = null
  if (cursorParam) {
    const [d, i] = cursorParam.split('|')
    cursorDate = d ?? null
    cursorId   = i ?? null
  }

  const rows = await db
    .select({
      slug:        schema.blogPosts.slug,
      title:       schema.blogPosts.title,
      excerpt:     schema.blogPosts.excerpt,
      coverR2Key:  schema.blogPosts.coverR2Key,
      coverAlt:    schema.blogPosts.coverAlt,
      tags:        schema.blogPosts.tags,
      publishedAt: schema.blogPosts.publishedAt,
      id:          schema.blogPosts.id,
    })
    .from(schema.blogPosts)
    .where(
      cursorDate && cursorId
        ? and(
            eq(schema.blogPosts.status, 'published'),
            or(
              lt(schema.blogPosts.publishedAt, cursorDate),
              and(eq(schema.blogPosts.publishedAt, cursorDate), lt(schema.blogPosts.id, cursorId)),
            ),
          )
        : eq(schema.blogPosts.status, 'published'),
    )
    .orderBy(desc(schema.blogPosts.publishedAt), desc(schema.blogPosts.id))
    .limit(PAGE_SIZE + 1)
    .all()

  const hasMore = rows.length > PAGE_SIZE
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? `${last.publishedAt}|${last.id}` : null

  const posts = items.map(r => ({
    ...r,
    tags: parseTags(r.tags),
    publishedAt: r.publishedAt ?? '',
  }))

  const version = await getDataVersion(db)
  const etag = etagFor({ count: posts.length, maxUpdatedAt: last?.publishedAt ?? '', version })

  return edgeCached(c, {
    etag,
    cacheControl: 'public, max-age=60, s-maxage=600, stale-while-revalidate=300',
    build: async () => ({ posts, nextCursor }),
  })
})

// ─── GET /:slug — single published post (draft → 404) ────────────────────────

app.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createDb(c.env.DB)

  if (!isFeatureEnabled({ blogEnabled: await getBlogEnabled(db) }, 'blogEnabled')) {
    return c.notFound()
  }

  const [row] = await db
    .select()
    .from(schema.blogPosts)
    .where(and(eq(schema.blogPosts.slug, slug), eq(schema.blogPosts.status, 'published')))
    .limit(1)

  if (!row) return c.notFound()

  const post = { ...row, tags: parseTags(row.tags) }

  const version = await getDataVersion(db)
  const etag = etagFor({ count: 1, maxUpdatedAt: row.updatedAt, version })

  return edgeCached(c, {
    etag,
    cacheControl: 'public, max-age=60, s-maxage=600, stale-while-revalidate=300',
    build: async () => post,
  })
})

export default app
