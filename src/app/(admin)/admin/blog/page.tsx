'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { en } from '@/lib/i18n/en'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { formatDate } from '@/lib/utils/index'
import type { BlogPost } from '@/lib/types/blog'

export default function AdminBlogListPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiGet<{ posts: BlogPost[] }>('/api/admin/blog')
      .then((res) => { if (!cancelled) setPosts(res.posts) })
      .catch(() => { if (!cancelled) toast.error(en.errors.networkError) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleTogglePublish(post: BlogPost) {
    const isPublished = post.status === 'published'
    const endpoint = isPublished
      ? `/api/admin/blog/${post.id}/unpublish`
      : `/api/admin/blog/${post.id}/publish`

    setToggling(post.id)
    try {
      await apiPost(endpoint)
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                status: isPublished ? 'draft' : 'published',
                // Server preserves publishedAt on unpublish; on first publish, stamp client-side.
                publishedAt: isPublished ? post.publishedAt : (post.publishedAt ?? new Date().toISOString()),
              }
            : p,
        ),
      )
    } catch {
      toast.error(en.errors.networkError)
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/admin/blog/${deleteTarget.id}`)
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error(en.errors.networkError)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={en.admin.blog}
        actions={
          <Button size="sm" onClick={() => router.push('/admin/blog/new')}>
            <Plus className="size-3.5 mr-1" aria-hidden />
            {en.admin.addPost}
          </Button>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {en.admin.blogEditorNoPosts}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium text-sm">{post.title}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                    {post.status === 'published'
                      ? en.admin.blogEditorPublished
                      : en.admin.blogEditorDraft}
                  </Badge>
                  {post.publishedAt && (
                    <span className="text-xs text-muted-foreground">
                      {en.admin.blogEditorPublishedAt}: {formatDate(post.publishedAt)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/admin/blog/${post.id}`)}
                >
                  <Pencil className="size-3.5 mr-1" aria-hidden />
                  {en.admin.editPage}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={toggling === post.id}
                  onClick={() => handleTogglePublish(post)}
                >
                  {post.status === 'published'
                    ? en.admin.blogEditorUnpublish
                    : en.admin.blogEditorPublish}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(post)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{en.admin.blog}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {en.admin.blogEditorDeleteConfirm}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {en.admin.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? en.admin.blogEditorDeleting : en.admin.deleteReview}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
