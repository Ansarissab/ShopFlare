import type { BlogStatus } from '@/lib/constants'

export interface BlogPost {
  id: string
  slug: string
  title: string
  bodyHtml: string
  excerpt: string
  coverR2Key: string | null
  coverAlt: string | null
  tags: string[] // parsed from JSON string in D1
  status: BlogStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

// Lightweight shape returned by the public list endpoint (no body).
export interface BlogPostSummary {
  slug: string
  title: string
  excerpt: string
  coverR2Key: string | null
  coverAlt: string | null
  tags: string[]
  publishedAt: string
}

export interface BlogListResponse {
  posts: BlogPostSummary[]
  nextCursor: string | null
}
