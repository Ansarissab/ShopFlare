'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { GripVertical, X, Plus, Pencil, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { FormField } from '@/components/common/FormField'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { RichText } from '@/components/shared/RichText'
import { ImageUpload } from '@/components/shared/ImageUpload'
import { useT } from '@/lib/i18n/Provider'
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { DATA_UPDATED_CHANNEL } from '@/hooks/useApiResource'
import { LANDING_SECTION_KEYS, LANDING_TEMPLATES } from '@/lib/constants'
import type { LandingSectionKey, LandingTemplate } from '@/lib/constants'
import type { LandingSection, AdminLandingResponse, LandingPageSummary } from '@/lib/types'
import type { ProductWithVariants } from '@/lib/types/product'

interface ImageUploadResult {
  r2Key: string
  imageUrl: string
}

function broadcastUpdated() {
  if (typeof BroadcastChannel !== 'undefined') {
    new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
  }
}

export default function AdminLandingPage() {
  const t = useT()

  const SECTION_LABELS: Record<LandingSectionKey, string> = {
    hero: t.admin.landingSectionHero,
    story: t.admin.landingSectionStory,
    featured: t.admin.landingSectionFeatured,
    reviews: t.admin.landingSectionReviews,
    cta: t.admin.landingSectionCta,
  }

  const TEMPLATE_LABELS: Record<LandingTemplate, string> = {
    classic: t.admin.landingTemplateClassic,
    wise: t.admin.landingTemplateWise,
    stripe: t.admin.landingTemplateStripe,
    yc: t.admin.landingTemplateYc,
  }

  const { config, loading: configLoading } = useStoreConfig()
  const [pages, setPages] = useState<LandingPageSummary[]>([])
  const [currentPageId, setCurrentPageId] = useState<string>('')
  const [landing, setLanding] = useState<AdminLandingResponse | null>(null)
  const [loadingLanding, setLoadingLanding] = useState(true)
  const [switchingPage, setSwitchingPage] = useState(false)
  const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({})
  const [featuredSaving, setFeaturedSaving] = useState(false)

  // landingEnabled: optimistic local override (null = defer to config)
  const [landingOverride, setLandingOverride] = useState<boolean | null>(null)
  const landingEnabled = landingOverride ?? config?.landingEnabled ?? false
  const [flagSaving, setFlagSaving] = useState(false)

  // Featured products state
  const [allProducts, setAllProducts] = useState<ProductWithVariants[]>([])
  const [featuredIds, setFeaturedIds] = useState<string[]>([])

  // Page management UI state
  const [newPageName, setNewPageName] = useState('')
  const [newPageTemplate, setNewPageTemplate] = useState<LandingTemplate>('classic')
  const [creatingPage, setCreatingPage] = useState(false)
  const [showCreateInput, setShowCreateInput] = useState(false)

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Activate saving
  const [activating, setActivating] = useState(false)

  // Template saving
  const [templateSaving, setTemplateSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      apiGet<AdminLandingResponse>('/api/admin/landing'),
      apiGet<{ products: ProductWithVariants[] }>('/api/products'),
    ])
      .then(([landingRes, productsRes]) => {
        setLanding(landingRes)
        setPages(landingRes.pages)
        setCurrentPageId(landingRes.pageId)
        setFeaturedIds(landingRes.featuredProductIds ?? [])
        setAllProducts(productsRes.products ?? [])
      })
      .catch(() => toast.error(t.errors.networkError))
      .finally(() => setLoadingLanding(false))
  }, [t])

  async function switchToPage(pageId: string) {
    if (pageId === currentPageId) return
    setSwitchingPage(true)
    try {
      const res = await apiGet<AdminLandingResponse>(`/api/admin/landing?pageId=${pageId}`)
      setLanding(res)
      setPages(res.pages)
      setCurrentPageId(res.pageId)
      setFeaturedIds(res.featuredProductIds ?? [])
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setSwitchingPage(false)
    }
  }

  async function handleToggleLanding(enabled: boolean) {
    setLandingOverride(enabled)
    setFlagSaving(true)
    try {
      await apiPut('/api/admin/config/store', { landingEnabled: enabled })
      broadcastUpdated()
      setLandingOverride(null)
    } catch {
      setLandingOverride(!enabled)
      toast.error(t.errors.networkError)
    } finally {
      setFlagSaving(false)
    }
  }

  const updateSection = useCallback((key: LandingSectionKey, patch: Partial<LandingSection>) => {
    setLanding((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [key]: { ...prev.sections[key], ...patch },
        },
      }
    })
  }, [])

  async function saveSection(key: LandingSectionKey) {
    const section = landing?.sections[key]
    if (!section) return
    setSectionSaving((s) => ({ ...s, [key]: true }))
    try {
      await apiPut(`/api/admin/landing/sections/${key}?pageId=${currentPageId}`, {
        enabled: section.enabled,
        heading: section.heading,
        subtext: section.subtext,
        bodyHtml: section.bodyHtml,
        ctaText: section.ctaText,
        ctaHref: section.ctaHref,
        imageR2Key: section.imageR2Key,
      })
      toast.success(t.admin.landingSaved)
      broadcastUpdated()
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setSectionSaving((s) => ({ ...s, [key]: false }))
    }
  }

  async function saveFeatured() {
    setFeaturedSaving(true)
    try {
      await apiPut(`/api/admin/landing/featured?pageId=${currentPageId}`, {
        productIds: featuredIds,
      })
      toast.success(t.admin.landingFeaturedSaved)
      broadcastUpdated()
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setFeaturedSaving(false)
    }
  }

  function moveFeatured(id: string, dir: -1 | 1) {
    setFeaturedIds((prev) => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  async function handleCreatePage() {
    const name = newPageName.trim()
    if (!name) return
    setCreatingPage(true)
    try {
      const created = await apiPost<LandingPageSummary>('/api/admin/landing/pages', {
        name,
        template: newPageTemplate,
      })
      // Refetch to get sections for the new page
      const res = await apiGet<AdminLandingResponse>(`/api/admin/landing?pageId=${created.id}`)
      setLanding(res)
      setPages(res.pages)
      setCurrentPageId(res.pageId)
      setFeaturedIds(res.featuredProductIds ?? [])
      setNewPageName('')
      setNewPageTemplate('classic')
      setShowCreateInput(false)
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setCreatingPage(false)
    }
  }

  async function handleRename(id: string) {
    const name = renameValue.trim()
    if (!name) return
    setRenameSaving(true)
    try {
      await apiPatch(`/api/admin/landing/pages/${id}`, { name })
      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
      setRenamingId(null)
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setRenameSaving(false)
    }
  }

  async function handleTemplateChange(template: LandingTemplate) {
    if (!currentPageId) return
    setTemplateSaving(true)
    try {
      await apiPatch(`/api/admin/landing/pages/${currentPageId}`, { template })
      setPages((prev) => prev.map((p) => (p.id === currentPageId ? { ...p, template } : p)))
      broadcastUpdated()
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setTemplateSaving(false)
    }
  }

  async function handleActivate(id: string) {
    setActivating(true)
    try {
      await apiPost(`/api/admin/landing/pages/${id}/activate`)
      setPages((prev) => prev.map((p) => ({ ...p, isActive: p.id === id })))
      broadcastUpdated()
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setActivating(false)
    }
  }

  async function handleDelete() {
    if (!deleteConfirmId) return
    setDeleting(true)
    try {
      await apiDelete(`/api/admin/landing/pages/${deleteConfirmId}`)
      // Refetch: switch to the active page
      const res = await apiGet<AdminLandingResponse>('/api/admin/landing')
      setLanding(res)
      setPages(res.pages)
      setCurrentPageId(res.pageId)
      setFeaturedIds(res.featuredProductIds ?? [])
      setDeleteConfirmId(null)
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : t.admin.landingLastPageError
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const currentPage = pages.find((p) => p.id === currentPageId)

  if (configLoading || loadingLanding) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Full-width header */}
      <AdminPageHeader title={t.admin.landingPage} />
      <p className="text-sm text-muted-foreground -mt-4">{t.admin.landingPageHint}</p>

      {/* Master toggle */}
      <label className="flex items-center justify-between rounded-lg border p-4 cursor-pointer">
        <div>
          <p className="font-medium">{t.admin.landingEnabled}</p>
          <p className="text-xs text-muted-foreground">{t.admin.landingEnabledHint}</p>
        </div>
        <input
          type="checkbox"
          checked={landingEnabled}
          onChange={(e) => handleToggleLanding(e.target.checked)}
          disabled={flagSaving}
          className="h-4 w-4 accent-primary"
        />
      </label>

      {/* Page management bar */}
      <div className="rounded-lg border p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t.admin.landingPagesLabel}</p>
          <Button size="sm" variant="outline" onClick={() => setShowCreateInput((v) => !v)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t.admin.landingNewPage}
          </Button>
        </div>

        {/* Create new page inline form */}
        {showCreateInput && (
          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3 bg-muted/30">
            <div className="flex-1 min-w-40">
              <FormField label={t.admin.landingPageName} htmlFor="new-page-name">
                <Input
                  id="new-page-name"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder={t.admin.landingPageName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreatePage()
                  }}
                />
              </FormField>
            </div>
            <FormField label={t.admin.landingTemplateLabel} htmlFor="new-page-template">
              <Select
                value={newPageTemplate}
                onValueChange={(v) => setNewPageTemplate(v as LandingTemplate)}
              >
                <SelectTrigger id="new-page-template" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANDING_TEMPLATES.map((tpl) => (
                    <SelectItem key={tpl} value={tpl}>
                      {TEMPLATE_LABELS[tpl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <Button
              onClick={handleCreatePage}
              disabled={creatingPage || !newPageName.trim()}
              size="sm"
            >
              {creatingPage ? t.admin.saving : t.admin.save}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateInput(false)
                setNewPageName('')
              }}
            >
              {t.admin.cancel}
            </Button>
          </div>
        )}

        {/* Page list */}
        <div className="flex flex-col gap-2">
          {pages.map((page) => {
            const isCurrent = page.id === currentPageId
            const isRenaming = renamingId === page.id
            return (
              <div
                key={page.id}
                className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                  isCurrent ? 'border-primary bg-primary/5' : 'hover:bg-muted/30 cursor-pointer'
                }`}
                onClick={() => {
                  if (!isCurrent && !isRenaming) void switchToPage(page.id)
                }}
              >
                {/* Name / rename input */}
                {isRenaming ? (
                  <Input
                    className="h-7 flex-1 min-w-32 max-w-48"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename(page.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-sm font-medium">{page.name}</span>
                )}

                {page.isActive && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {t.admin.landingActiveBadge}
                  </Badge>
                )}

                <span className="text-xs text-muted-foreground shrink-0">
                  {TEMPLATE_LABELS[page.template]}
                </span>

                {/* Actions */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isRenaming ? (
                    <button
                      type="button"
                      className="p-1 text-primary hover:opacity-80 disabled:opacity-40"
                      disabled={renameSaving}
                      onClick={() => void handleRename(page.id)}
                      aria-label={t.admin.save}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setRenamingId(page.id)
                        setRenameValue(page.name)
                      }}
                      aria-label={t.admin.landingRename}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {!page.isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      disabled={activating}
                      onClick={() => void handleActivate(page.id)}
                    >
                      {t.admin.landingActivate}
                    </Button>
                  )}

                  {pages.length > 1 && (
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteConfirmId(page.id)}
                      aria-label={t.admin.landingDeletePage}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Template picker for current page */}
        {currentPage && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-sm text-muted-foreground shrink-0">
              {t.admin.landingTemplateLabel}:
            </span>
            <Select
              value={currentPage.template}
              onValueChange={(v) => void handleTemplateChange(v as LandingTemplate)}
              disabled={templateSaving}
            >
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANDING_TEMPLATES.map((tpl) => (
                  <SelectItem key={tpl} value={tpl}>
                    {TEMPLATE_LABELS[tpl]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Editor area: loading state while switching pages */}
      {switchingPage ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section editors */}
          {LANDING_SECTION_KEYS.map((key) => {
            const section = landing?.sections[key]
            if (!section) return null
            const saving = sectionSaving[key] ?? false

            return (
              <div key={key} className="rounded-lg border p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-base">{SECTION_LABELS[key]}</h2>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-muted-foreground">
                      {t.admin.landingSectionEnabled}
                    </span>
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={(e) => updateSection(key, { enabled: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>

                {(key === 'hero' || key === 'story' || key === 'featured' || key === 'cta') && (
                  <FormField label={t.admin.landingHeading} htmlFor={`${key}-heading`}>
                    <Input
                      id={`${key}-heading`}
                      value={section.heading ?? ''}
                      onChange={(e) => updateSection(key, { heading: e.target.value })}
                    />
                  </FormField>
                )}

                {(key === 'hero' || key === 'cta') && (
                  <>
                    <FormField label={t.admin.landingSubtext} htmlFor={`${key}-subtext`}>
                      <Input
                        id={`${key}-subtext`}
                        value={section.subtext ?? ''}
                        onChange={(e) => updateSection(key, { subtext: e.target.value })}
                      />
                    </FormField>
                    <FormField label={t.admin.landingCtaText} htmlFor={`${key}-ctatext`}>
                      <Input
                        id={`${key}-ctatext`}
                        value={section.ctaText ?? ''}
                        onChange={(e) => updateSection(key, { ctaText: e.target.value })}
                      />
                    </FormField>
                    <FormField label={t.admin.landingCtaHref} htmlFor={`${key}-ctahref`}>
                      <Input
                        id={`${key}-ctahref`}
                        value={section.ctaHref ?? ''}
                        onChange={(e) => updateSection(key, { ctaHref: e.target.value })}
                      />
                    </FormField>
                  </>
                )}

                {key === 'story' && (
                  <FormField label={t.admin.landingBodyHtml} htmlFor={`${key}-body`}>
                    <RichText
                      value={section.bodyHtml ?? ''}
                      onChange={(html) => updateSection(key, { bodyHtml: html })}
                      uploadEndpoint="/api/admin/landing/image"
                    />
                  </FormField>
                )}

                {(key === 'hero' || key === 'story') && (
                  <FormField label={t.admin.landingImage} htmlFor={`${key}-image`}>
                    <ImageUpload<ImageUploadResult>
                      endpoint="/api/admin/landing/image"
                      extraFields={{ sectionKey: key }}
                      onUploaded={(result) => updateSection(key, { imageR2Key: result.r2Key })}
                      onDeleted={() => updateSection(key, { imageR2Key: null })}
                      deleteEndpoint={(r2Key) => `/api/admin/landing/image/${r2Key}`}
                      max={1}
                      currentImages={
                        section.imageR2Key
                          ? [{ id: section.imageR2Key, url: `/cdn/${section.imageR2Key}` }]
                          : []
                      }
                    />
                  </FormField>
                )}

                <div className="mt-auto flex justify-end">
                  <Button onClick={() => saveSection(key)} disabled={saving}>
                    {saving ? t.admin.saving : t.admin.save}
                  </Button>
                </div>
              </div>
            )
          })}

          {/* Featured products card */}
          <div className="rounded-lg border p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-base">{t.admin.landingFeaturedProducts}</h2>
            <p className="text-xs text-muted-foreground">{t.admin.landingFeaturedHint}</p>

            {/* Current ordered list */}
            {featuredIds.length > 0 && (
              <ul className="flex flex-col gap-1">
                {featuredIds.map((id, idx) => {
                  const item = allProducts.find((p) => p.product.id === id)
                  if (!item) return null
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm">{item.product.name}</span>
                      <button
                        type="button"
                        onClick={() => moveFeatured(id, -1)}
                        disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs px-1"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFeatured(id, 1)}
                        disabled={idx === featuredIds.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs px-1"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeaturedIds((prev) => prev.filter((x) => x !== id))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Add picker */}
            {featuredIds.length < 20 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.admin.landingFeaturedProducts}
                </p>
                <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                  {allProducts
                    .filter((p) => !featuredIds.includes(p.product.id))
                    .map((item) => (
                      <button
                        key={item.product.id}
                        type="button"
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-muted"
                        onClick={() => setFeaturedIds((prev) => [...prev, item.product.id])}
                      >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {item.product.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-auto flex justify-end">
              <Button onClick={saveFeatured} disabled={featuredSaving}>
                {featuredSaving ? t.admin.saving : t.admin.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.landingDeletePage}</AlertDialogTitle>
            <AlertDialogDescription>{t.admin.landingDeletePageConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.admin.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? t.admin.saving : t.admin.landingDeletePage}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
