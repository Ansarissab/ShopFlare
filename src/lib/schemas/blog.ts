import { z } from 'zod/v4'
import { BLOG_STATUSES, CATEGORY_SLUG_PATTERN } from '@/lib/constants'

export const blogPostBase = z.object({
  slug:       z.string().min(1).max(120).regex(CATEGORY_SLUG_PATTERN),
  title:      z.string().min(1).max(200),
  bodyHtml:   z.string().default(''),
  excerpt:    z.string().max(300).default(''),
  coverR2Key: z.string().nullable().default(null),
  coverAlt:   z.string().max(200).nullable().default(null),
  tags:       z.array(z.string().max(40)).max(20).default([]),
  status:     z.enum(BLOG_STATUSES).default('draft'),
})

export const blogPostCreate = blogPostBase
export const blogPostUpdate = blogPostBase.partial()

export const blogPostPublic = blogPostBase.pick({
  slug:       true,
  title:      true,
  excerpt:    true,
  coverR2Key: true,
  coverAlt:   true,
  tags:       true,
})

export type BlogPostCreateInput = z.infer<typeof blogPostCreate>
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdate>
export type BlogPostPublicSummary = z.infer<typeof blogPostPublic>
