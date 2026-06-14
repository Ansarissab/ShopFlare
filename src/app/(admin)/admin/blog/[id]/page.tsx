'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { FormField } from '@/components/common/FormField'
import { RichText } from '@/components/shared/RichText'
import { ImageUpload } from '@/components/shared/ImageUpload'
import { useT } from '@/lib/i18n/Provider'
import { apiGet, apiPost, apiPatch, WORKER_URL } from '@/lib/api'
import { formatDate } from '@/lib/utils/index'
import { CATEGORY_SLUG_PATTERN } from '@/lib/constants'
import type { BlogPost } from '@/lib/types/blog'

// ─── Slug helpers ─────────────────────────────────────────────────────────────

function deriveSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT()
  const { id } = React.use(params)
  const isNew = id === 'new'
  const router = useRouter()

  // ── load state ──
  const [loading, setLoading] = useState(!isNew)

  // ── form fields ──
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [tags, setTags] = useState('') // comma-separated string
  const [bodyHtml, setBodyHtml] = useState('')
  const [coverR2Key, setCoverR2Key] = useState<string | null>(null)
  const [coverAlt, setCoverAlt] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [publishedAt, setPublishedAt] = useState<string | null>(null)

  // ── derived UI state ──
  const [slugTouched, setSlugTouched] = useState(false) // user manually edited slug
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [slugError, setSlugError] = useState<string | undefined>()

  // ── load existing post ──
  useEffect(() => {
    if (isNew) return
    let cancelled = false
    apiGet<BlogPost>(`/api/admin/blog/${id}`)
      .then((post) => {
        if (cancelled) return
        setTitle(post.title)
        setSlug(post.slug)
        setExcerpt(post.excerpt ?? '')
        setTags(post.tags?.join(', ') ?? '')
        setBodyHtml(post.bodyHtml ?? '')
        setCoverR2Key(post.coverR2Key ?? null)
        setCoverAlt(post.coverAlt ?? '')
        setStatus(post.status)
        setPublishedAt(post.publishedAt ?? null)
        setSlugTouched(true) // existing slug — treat as manually set
      })
      .catch(() => {
        if (!cancelled) toast.error(t.errors.networkError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew, t])

  // ── auto-derive slug from title ──
  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugTouched) {
      setSlug(deriveSlug(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true)
    setSlug(value)
    if (value && !CATEGORY_SLUG_PATTERN.test(value)) {
      setSlugError(t.admin.blogEditorSlugHint)
    } else {
      setSlugError(undefined)
    }
  }

  // ── save ──
  async function handleSave() {
    if (!slug || !title) return
    if (slug && !CATEGORY_SLUG_PATTERN.test(slug)) {
      setSlugError(t.admin.blogEditorSlugHint)
      return
    }

    const payload = {
      title,
      slug,
      excerpt,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
      bodyHtml,
      coverR2Key: coverR2Key ?? null,
      coverAlt: coverAlt || null,
    }

    setSaving(true)
    try {
      if (isNew) {
        const created = await apiPost<{ id: string; slug: string }>('/api/admin/blog', payload)
        toast.success(t.admin.blogEditorCreated)
        router.push(`/admin/blog/${created.id}`)
      } else {
        await apiPatch(`/api/admin/blog/${id}`, payload)
        toast.success(t.admin.blogEditorSaved)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errors.networkError
      if (msg.toLowerCase().includes('slug')) {
        setSlugError(t.admin.blogEditorSlugTaken)
      } else {
        toast.error(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  // ── publish / unpublish ──
  async function handleTogglePublish() {
    if (isNew) {
      await handleSave()
      return
    }
    const isPublished = status === 'published'
    const endpoint = isPublished
      ? `/api/admin/blog/${id}/unpublish`
      : `/api/admin/blog/${id}/publish`

    setPublishing(true)
    try {
      await apiPost(endpoint)
      const next: 'draft' | 'published' = isPublished ? 'draft' : 'published'
      setStatus(next)
      setPublishedAt(isPublished ? null : new Date().toISOString())
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setPublishing(false)
    }
  }

  // ── cover image items for ImageUpload ──
  const coverImages = coverR2Key ? [{ id: coverR2Key, url: `${WORKER_URL}/cdn/${coverR2Key}` }] : []

  // ── editor title ──
  const pageTitle = isNew ? t.admin.addPost : title || t.admin.blog

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <AdminPageHeader
        title={pageTitle}
        backHref="/admin/blog"
        actions={
          <div className="flex items-center gap-2">
            {!isNew && publishedAt && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {t.admin.blogEditorPublishedAt}: {formatDate(publishedAt)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={publishing || saving}
              onClick={handleTogglePublish}
            >
              {status === 'published' ? t.admin.blogEditorUnpublish : t.admin.blogEditorPublish}
            </Button>
            <Button size="sm" disabled={saving || publishing} onClick={handleSave}>
              {saving ? t.admin.blogEditorSaving : t.admin.blogEditorSave}
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Title */}
          <FormField label={t.admin.blogEditorTitle} htmlFor="blog-title">
            <Input
              id="blog-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t.admin.blogEditorTitle}
            />
          </FormField>

          {/* Slug */}
          <FormField label={t.admin.blogEditorSlug} htmlFor="blog-slug" error={slugError}>
            <Input
              id="blog-slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="my-post-slug"
            />
            <p className="text-xs text-muted-foreground">{t.admin.blogEditorSlugHint}</p>
          </FormField>

          {/* Excerpt */}
          <FormField label={t.admin.blogEditorExcerpt} htmlFor="blog-excerpt" optional>
            <Textarea
              id="blog-excerpt"
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder={t.admin.blogEditorExcerpt}
            />
            <p className="text-xs text-muted-foreground">{t.admin.blogEditorExcerptHint}</p>
          </FormField>

          {/* Tags */}
          <FormField label={t.admin.blogEditorTags} htmlFor="blog-tags" optional>
            <Input
              id="blog-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
            <p className="text-xs text-muted-foreground">{t.admin.blogEditorTagsHint}</p>
          </FormField>

          {/* Cover image */}
          <FormField label={t.admin.blogEditorCover} htmlFor="blog-cover" optional>
            <ImageUpload
              endpoint="/api/admin/blog/image"
              deleteEndpoint={(key) => `/api/admin/blog/image/${key}`}
              max={1}
              currentImages={coverImages}
              onUploaded={(r: { r2Key: string }) => {
                setCoverR2Key(r.r2Key)
                setCoverAlt('')
              }}
              onDeleted={() => setCoverR2Key(null)}
            />
            {coverR2Key && (
              <Input
                id="blog-cover-alt"
                value={coverAlt}
                onChange={(e) => setCoverAlt(e.target.value)}
                placeholder={t.admin.blogEditorCoverAlt}
                className="mt-2"
              />
            )}
          </FormField>

          {/* Body */}
          <FormField label={t.admin.blogEditorBody} htmlFor="blog-body">
            <RichText
              value={bodyHtml}
              onChange={setBodyHtml}
              uploadEndpoint="/api/admin/blog/image"
            />
          </FormField>

          {/* Bottom save row */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={publishing || saving}
              onClick={handleTogglePublish}
            >
              {status === 'published' ? t.admin.blogEditorUnpublish : t.admin.blogEditorPublish}
            </Button>
            <Button size="sm" disabled={saving || publishing} onClick={handleSave}>
              {saving ? t.admin.blogEditorSaving : t.admin.blogEditorSave}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
