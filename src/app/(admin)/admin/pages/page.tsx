'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/common/FormField'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { en } from '@/lib/i18n/en'
import { apiGet, apiPut } from '@/lib/api'
import { formatDate } from '@/lib/utils/index'
import { POLICY_SLUGS } from '@/lib/constants'
import type { AdminPagesResponse, StorePage } from '@/lib/types/admin'

const POLICY_LABELS: Record<string, string> = {
  shipping: en.policies.shipping,
  returns:  en.policies.returns,
  privacy:  en.policies.privacy,
  terms:    en.policies.terms,
}

interface EditState {
  title: string
  content: string
  saving: boolean
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState<StorePage[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ title: '', content: '', saving: false })

  useEffect(() => {
    apiGet<AdminPagesResponse>('/api/admin/pages')
      .then((res) => setPages(res.pages))
      .catch(() => toast.error(en.errors.networkError))
      .finally(() => setLoading(false))
  }, [])

  function startEdit(slug: string) {
    const existing = pages.find((p) => p.slug === slug)
    setEditState({
      title:   existing?.title   ?? POLICY_LABELS[slug] ?? slug,
      content: existing?.content ?? '',
      saving:  false,
    })
    setEditing(slug)
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function handleSave(slug: string) {
    setEditState((s) => ({ ...s, saving: true }))
    try {
      await apiPut(`/api/admin/pages/${slug}`, {
        title:   editState.title.trim() || POLICY_LABELS[slug],
        content: editState.content,
      })
      setPages((prev) => {
        const idx = prev.findIndex((p) => p.slug === slug)
        const updated: StorePage = {
          slug,
          title:     editState.title.trim() || (POLICY_LABELS[slug] ?? slug),
          content:   editState.content,
          updatedAt: new Date().toISOString(),
        }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
      toast.success(en.admin.pageSaved)
      setEditing(null)
    } catch {
      toast.error(en.errors.networkError)
    } finally {
      setEditState((s) => ({ ...s, saving: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <AdminPageHeader title={en.admin.policyPages} />

      {POLICY_SLUGS.map((slug) => {
        const saved = pages.find((p) => p.slug === slug)
        const isEditing = editing === slug

        return (
          <div key={slug} className="rounded-lg border p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{POLICY_LABELS[slug]}</span>
                {saved?.updatedAt && (
                  <span className="text-xs text-muted-foreground">
                    {en.policies.lastUpdated.replace(
                      '{date}',
                      formatDate(saved.updatedAt, { year: 'numeric', month: 'short', day: 'numeric' }, undefined),
                    )}
                  </span>
                )}
              </div>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => startEdit(slug)}>
                  {en.admin.editPage}
                </Button>
              )}
            </div>

            {isEditing && (
              <div className="flex flex-col gap-4">
                <FormField label={en.admin.pageTitle} htmlFor={`title-${slug}`}>
                  <Input
                    id={`title-${slug}`}
                    value={editState.title}
                    onChange={(e) => setEditState((s) => ({ ...s, title: e.target.value }))}
                  />
                </FormField>

                <FormField label={en.admin.pageContent} htmlFor={`content-${slug}`}>
                  <Textarea
                    id={`content-${slug}`}
                    rows={12}
                    value={editState.content}
                    onChange={(e) => setEditState((s) => ({ ...s, content: e.target.value }))}
                    placeholder={en.admin.pageContentHint}
                    className="resize-y font-mono text-xs"
                  />
                </FormField>
                <p className="text-xs text-muted-foreground -mt-2">{en.admin.pageContentHint}</p>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSave(slug)}
                    disabled={editState.saving}
                    size="sm"
                  >
                    {editState.saving ? en.admin.saving : en.admin.save}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={editState.saving}>
                    {en.admin.cancel}
                  </Button>
                </div>
              </div>
            )}

            {!isEditing && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {saved?.content
                  ? saved.content.slice(0, 120) + (saved.content.length > 120 ? '…' : '')
                  : <em>{en.policies.empty}</em>
                }
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
