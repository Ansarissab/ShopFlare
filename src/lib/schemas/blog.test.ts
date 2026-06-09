import { describe, expect, it } from 'vitest'
import { blogPostBase, blogPostCreate, blogPostUpdate, blogPostPublic } from './blog'

describe('blogPostBase', () => {
  it('validates a valid post object (all fields)', () => {
    const result = blogPostBase.safeParse({
      slug:       'my-first-post',
      title:      'My First Post',
      bodyHtml:   '<p>Hello world</p>',
      excerpt:    'A short intro.',
      coverR2Key: 'images/cover.jpg',
      coverAlt:   'Cover image',
      tags:       ['news', 'update'],
      status:     'draft',
    })
    expect(result.success).toBe(true)
  })

  it('rejects slug with uppercase letters', () => {
    const result = blogPostBase.safeParse({
      slug:  'My-Post',
      title: 'My Post',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = blogPostBase.safeParse({
      slug:  'my post',
      title: 'My Post',
    })
    expect(result.success).toBe(false)
  })

  it('rejects title longer than 200 characters', () => {
    const result = blogPostBase.safeParse({
      slug:  'valid-slug',
      title: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('rejects tags array longer than 20 items', () => {
    const result = blogPostBase.safeParse({
      slug:  'valid-slug',
      title: 'Valid Title',
      tags:  Array.from({ length: 21 }, (_, i) => `tag-${i}`),
    })
    expect(result.success).toBe(false)
  })
})

describe('blogPostUpdate', () => {
  it('allows partial update (only title, rest undefined)', () => {
    const result = blogPostUpdate.safeParse({ title: 'New Title Only' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('New Title Only')
      expect(result.data.slug).toBeUndefined()
      // bodyHtml has .default('') in the base schema, so omitting it yields ''
      expect(result.data.bodyHtml === '' || result.data.bodyHtml === undefined).toBe(true)
    }
  })
})

describe('blogPostPublic', () => {
  it('only picks slug/title/excerpt/coverR2Key/coverAlt/tags — no bodyHtml, no status', () => {
    const result = blogPostPublic.safeParse({
      slug:       'public-post',
      title:      'Public Post',
      excerpt:    'Short excerpt',
      coverR2Key: 'images/cover.jpg',
      coverAlt:   'Alt text',
      tags:       ['tag1'],
      // these fields should be stripped / not accepted
      bodyHtml:   '<p>Secret content</p>',
      status:     'published',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveProperty('slug')
      expect(result.data).toHaveProperty('title')
      expect(result.data).toHaveProperty('excerpt')
      expect(result.data).toHaveProperty('coverR2Key')
      expect(result.data).toHaveProperty('coverAlt')
      expect(result.data).toHaveProperty('tags')
      expect(result.data).not.toHaveProperty('bodyHtml')
      expect(result.data).not.toHaveProperty('status')
    }
  })
})

describe('Default values', () => {
  it('default status is draft when omitted', () => {
    const result = blogPostBase.safeParse({
      slug:  'no-status',
      title: 'No Status',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('draft')
    }
  })
})
