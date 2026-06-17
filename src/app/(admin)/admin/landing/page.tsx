'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { GripVertical, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/common/FormField'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { RichText } from '@/components/shared/RichText'
import { ImageUpload } from '@/components/shared/ImageUpload'
import { useT } from '@/lib/i18n/Provider'
import { apiGet, apiPut } from '@/lib/api'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { DATA_UPDATED_CHANNEL } from '@/hooks/useApiResource'
import { LANDING_SECTION_KEYS } from '@/lib/constants'
import type { LandingSectionKey } from '@/lib/constants'
import type { LandingSection, AdminLandingResponse } from '@/lib/types'
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

  const { config, loading: configLoading } = useStoreConfig()
  const [landing, setLanding] = useState<AdminLandingResponse | null>(null)
  const [loadingLanding, setLoadingLanding] = useState(true)
  const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({})
  const [featuredSaving, setFeaturedSaving] = useState(false)

  // landingEnabled: optimistic local override (null = defer to config)
  const [landingOverride, setLandingOverride] = useState<boolean | null>(null)
  const landingEnabled = landingOverride ?? config?.landingEnabled ?? false
  const [flagSaving, setFlagSaving] = useState(false)

  // Featured products state
  const [allProducts, setAllProducts] = useState<ProductWithVariants[]>([])
  const [featuredIds, setFeaturedIds] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      apiGet<AdminLandingResponse>('/api/admin/landing'),
      apiGet<{ products: ProductWithVariants[] }>('/api/products'),
    ])
      .then(([landingRes, productsRes]) => {
        setLanding(landingRes)
        setFeaturedIds(landingRes.featuredProductIds ?? [])
        setAllProducts(productsRes.products ?? [])
      })
      .catch(() => toast.error(t.errors.networkError))
      .finally(() => setLoadingLanding(false))
  }, [t])

  async function handleToggleLanding(enabled: boolean) {
    setLandingOverride(enabled)
    setFlagSaving(true)
    try {
      await apiPut('/api/admin/config/store', { landingEnabled: enabled })
      broadcastUpdated()
      setLandingOverride(null) // let config refresh take over
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
      await apiPut(`/api/admin/landing/sections/${key}`, {
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
      await apiPut('/api/admin/landing/featured', { productIds: featuredIds })
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

  if (configLoading || loadingLanding) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <AdminPageHeader title={t.admin.landingPage} />
      <p className="text-sm text-muted-foreground -mt-6">{t.admin.landingPageHint}</p>

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

            {/* Fields vary by section */}
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

            <div className="flex justify-end">
              <Button onClick={() => saveSection(key)} disabled={saving}>
                {saving ? t.admin.saving : t.admin.save}
              </Button>
            </div>
          </div>
        )
      })}

      {/* Featured products multiselect */}
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
            <p className="text-xs font-medium text-muted-foreground">Add product</p>
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

        <div className="flex justify-end">
          <Button onClick={saveFeatured} disabled={featuredSaving}>
            {featuredSaving ? t.admin.saving : t.admin.save}
          </Button>
        </div>
      </div>
    </div>
  )
}
