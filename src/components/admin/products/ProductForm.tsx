'use client'

import { useState, useEffect, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/common/FormField'
import { ImageUpload } from '@/components/admin/products/ImageUpload'
import { en } from '@/lib/i18n/en'
import { apiPost, apiPut, apiDelete, apiGet } from '@/lib/api'
import { formatPrice } from '@/lib/utils/index'
import type { ProductWithVariants, VariantWithDetails, SizeOption, ProductImage } from '@/lib/types/product'
import type { AnalyticsProductDetail } from '@/lib/types/analytics'

// ─── Per-product stats panel (edit mode only) ─────────────────────────────────

function ProductStatsPanel({ productId }: { productId: string }) {
  const [stats, setStats] = useState<AnalyticsProductDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<AnalyticsProductDetail>(`/api/admin/analytics/products/${productId}?period=30d`)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [productId])

  return (
    <div className="rounded-lg border p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold">{en.admin.analyticsProductStats}</h2>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{en.admin.analyticsUnitsSold}</p>
              <p className="text-base font-semibold">{stats.unitsSold.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{en.admin.analyticsOrders}</p>
              <p className="text-base font-semibold">{stats.orders.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{en.admin.totalRevenue}</p>
              <p className="text-base font-semibold">{formatPrice(stats.revenueCents)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{en.admin.analyticsLastSold}</p>
              <p className="text-base font-semibold">
                {stats.lastSoldAt
                  ? new Date(stats.lastSoldAt).toLocaleDateString()
                  : en.admin.analyticsNeverSold}
              </p>
            </div>
          </div>

          {stats.affinityPartners.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {en.admin.analyticsFrequentlyBoughtWith}
              </p>
              <div className="flex flex-col gap-1">
                {stats.affinityPartners.slice(0, 3).map((partner) => (
                  <div
                    key={partner.productId}
                    className="flex items-center justify-between text-sm rounded-md border px-3 py-2"
                  >
                    <span>{partner.productName}</span>
                    <span className="text-xs text-muted-foreground">
                      {en.admin.analyticsTimesTogether}: {partner.pairCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

// ─── ProductForm ───────────────────────────────────────────────────────────────

interface ProductFormProps {
  initial?: ProductWithVariants
}

type LocalVariant = Omit<VariantWithDetails, 'id' | 'productId'> & {
  id: string
  productId: string
  isNew?: boolean
}

type LocalSize = Omit<SizeOption, 'id' | 'variantId'> & {
  id: string
  variantId: string
  isNew?: boolean
}

export function ProductForm({ initial }: ProductFormProps) {
  const router = useRouter()

  const [name, setName] = useState(initial?.product.name ?? '')
  const [description, setDescription] = useState(initial?.product.description ?? '')
  const [active, setActive] = useState(initial?.product.active ?? true)
  const [saving, setSaving] = useState(false)

  const [variants, setVariants] = useState<LocalVariant[]>(
    (initial?.variants ?? []).map((v) => ({
      ...v,
      sizes: v.sizes as LocalSize[],
    })) as LocalVariant[],
  )

  const [expandedVariant, setExpandedVariant] = useState<string | null>(
    initial?.variants[0]?.id ?? null,
  )

  // ─── Product save ─────────────────────────────────────────────────────────

  async function saveProduct() {
    if (!name.trim()) {
      toast.error(en.errors.required.replace('{field}', en.admin.productName))
      return
    }

    setSaving(true)
    try {
      const productId = initial?.product.id

      if (productId) {
        await apiPut(`/api/admin/products/${productId}`, { name, description, active })
        toast.success(en.admin.productUpdated)
      } else {
        const created = await apiPost<{ id: string }>('/api/admin/products', { name, description, active })
        toast.success(en.admin.productCreated)
        router.push(`/admin/products/${created.id}`)
        return
      }
    } catch {
      toast.error(en.errors.networkError)
    } finally {
      setSaving(false)
    }
  }

  // ─── Variant management ───────────────────────────────────────────────────

  async function addVariant() {
    if (!initial?.product.id) {
      toast.error('Save the product first before adding variants.')
      return
    }
    try {
      const newVariant = await apiPost<LocalVariant>('/api/admin/products/variants', {
        productId: initial.product.id,
        label: 'New Variant',
        sortOrder: variants.length,
      })
      setVariants((prev) => [...prev, { ...newVariant, images: [], sizes: [] }])
      setExpandedVariant(newVariant.id)
      toast.success(en.admin.variantCreated)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  async function updateVariantLabel(variantId: string, label: string) {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, label } : v)),
    )
  }

  async function saveVariant(variantId: string) {
    const variant = variants.find((v) => v.id === variantId)
    if (!variant) return
    try {
      await apiPut(`/api/admin/products/variants/${variantId}`, {
        label: variant.label,
        colorHex: variant.colorHex,
      })
      toast.success(en.admin.saved)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  async function deleteVariant(variantId: string) {
    if (!confirm(en.admin.deleteProductConfirm)) return
    try {
      await apiDelete(`/api/admin/products/variants/${variantId}`)
      setVariants((prev) => prev.filter((v) => v.id !== variantId))
      toast.success(en.admin.variantDeleted)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  // ─── Size management ──────────────────────────────────────────────────────

  async function addSize(variantId: string) {
    try {
      const newSize = await apiPost<LocalSize>('/api/admin/products/sizes', {
        variantId,
        size: 'M',
        priceCents: 0,
        stock: 0,
        active: true,
      })
      setVariants((prev) =>
        prev.map((v) =>
          v.id === variantId ? { ...v, sizes: [...(v.sizes as LocalSize[]), newSize] } : v,
        ),
      )
      toast.success(en.admin.sizeCreated)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  function updateSizeField(variantId: string, sizeId: string, field: string, value: string | number | boolean) {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId
          ? {
              ...v,
              sizes: (v.sizes as LocalSize[]).map((s) =>
                s.id === sizeId ? { ...s, [field]: value } : s,
              ),
            }
          : v,
      ),
    )
  }

  async function saveSize(sizeId: string, variantId: string) {
    const variant = variants.find((v) => v.id === variantId)
    const size = (variant?.sizes as LocalSize[])?.find((s) => s.id === sizeId)
    if (!size) return
    try {
      await apiPut(`/api/admin/products/sizes/${sizeId}`, {
        size: size.size,
        sku: size.sku,
        priceCents: size.priceCents,
        stock: size.stock,
        stripePriceId: size.stripePriceId,
        active: size.active,
      })
      toast.success(en.admin.saved)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  async function deleteSize(variantId: string, sizeId: string) {
    try {
      await apiDelete(`/api/admin/products/sizes/${sizeId}`)
      setVariants((prev) =>
        prev.map((v) =>
          v.id === variantId
            ? { ...v, sizes: (v.sizes as LocalSize[]).filter((s) => s.id !== sizeId) }
            : v,
        ),
      )
      toast.success(en.admin.sizeDeleted)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  // ─── Image callbacks ──────────────────────────────────────────────────────

  function handleImageUploaded(variantId: string, image: ProductImage) {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId ? { ...v, images: [...v.images, image] } : v,
      ),
    )
  }

  function handleImageDeleted(variantId: string, imageId: string) {
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId ? { ...v, images: v.images.filter((i) => i.id !== imageId) } : v,
      ),
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Basic fields */}
      <div className="rounded-lg border p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Basic Info</h2>

        <FormField label={en.admin.productName} htmlFor="product-name">
          <Input
            id="product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>

        <FormField label={en.admin.productDescription} htmlFor="product-desc">
          <Textarea
            id="product-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none"
          />
        </FormField>

        <div className="flex items-center gap-2">
          <Checkbox
            id="product-active"
            checked={active}
            onCheckedChange={(v: boolean) => setActive(v === true)}
          />
          <label htmlFor="product-active" className="text-sm cursor-pointer">
            {en.admin.active}
          </label>
        </div>

        <Button onClick={saveProduct} disabled={saving} size="sm">
          {saving ? en.admin.saving : initial ? en.admin.saved : en.admin.productCreated}
        </Button>
      </div>

      {/* Per-product analytics stats — edit mode only */}
      {initial?.product.id && (
        <ProductStatsPanel productId={initial.product.id} />
      )}

      {/* Variants — only shown once product is saved (has an ID) */}
      {initial?.product.id && (
        <div className="rounded-lg border p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{en.admin.variants}</h2>
            <Button size="sm" variant="outline" onClick={addVariant}>
              <Plus className="size-3.5 mr-1" aria-hidden />
              {en.admin.addVariant}
            </Button>
          </div>

          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No variants yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {variants.map((variant) => {
                const isExpanded = expandedVariant === variant.id
                return (
                  <div key={variant.id} className="rounded-md border">
                    {/* Variant header */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/40"
                      onClick={() => setExpandedVariant(isExpanded ? null : variant.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        )}
                        {variant.colorHex && (
                          <span
                            className="size-3.5 rounded-full border"
                            style={{ backgroundColor: variant.colorHex }}
                            aria-hidden
                          />
                        )}
                        <span className="text-sm font-medium">{variant.label}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(variant.sizes as LocalSize[]).length} sizes, {variant.images.length} images)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); deleteVariant(variant.id) }}
                        aria-label={en.admin.deleteVariant}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="border-t p-4 flex flex-col gap-4">
                        {/* Variant fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <FormField label={en.admin.variantLabel} htmlFor={`variant-label-${variant.id}`}>
                            <Input
                              id={`variant-label-${variant.id}`}
                              value={variant.label}
                              onChange={(e) => updateVariantLabel(variant.id, e.target.value)}
                            />
                          </FormField>
                          <FormField label={en.admin.colorHex} htmlFor={`variant-color-${variant.id}`}>
                            <div className="flex gap-2">
                              <Input
                                id={`variant-color-${variant.id}`}
                                value={variant.colorHex ?? ''}
                                onChange={(e) =>
                                  setVariants((prev) =>
                                    prev.map((v) =>
                                      v.id === variant.id ? { ...v, colorHex: e.target.value || null } : v,
                                    ),
                                  )
                                }
                                placeholder="#000000"
                              />
                              {variant.colorHex && (
                                <span
                                  className="size-10 rounded-md border shrink-0"
                                  style={{ backgroundColor: variant.colorHex }}
                                  aria-hidden
                                />
                              )}
                            </div>
                          </FormField>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => saveVariant(variant.id)}>
                          {en.admin.saved}
                        </Button>

                        <Separator />

                        {/* Images */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Images</p>
                          <ImageUpload
                            variantId={variant.id}
                            images={variant.images}
                            onUploaded={(img) => handleImageUploaded(variant.id, img)}
                            onDeleted={(imgId) => handleImageDeleted(variant.id, imgId)}
                          />
                        </div>

                        <Separator />

                        {/* Sizes */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground">Sizes</p>
                            <Button size="sm" variant="ghost" onClick={() => addSize(variant.id)}>
                              <Plus className="size-3.5 mr-1" aria-hidden />
                              {en.admin.addSize}
                            </Button>
                          </div>

                          {(variant.sizes as LocalSize[]).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No sizes yet.</p>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {(variant.sizes as LocalSize[]).map((size) => (
                                <div key={size.id} className="grid grid-cols-2 gap-2 items-end sm:grid-cols-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                                  <FormField label={en.admin.sizeName} htmlFor={`size-name-${size.id}`}>
                                    <Input
                                      id={`size-name-${size.id}`}
                                      value={size.size}
                                      onChange={(e) => updateSizeField(variant.id, size.id, 'size', e.target.value)}
                                    />
                                  </FormField>
                                  <FormField label={en.admin.priceCents} htmlFor={`size-price-${size.id}`}>
                                    <Input
                                      id={`size-price-${size.id}`}
                                      type="number"
                                      min={0}
                                      value={size.priceCents}
                                      onChange={(e) => updateSizeField(variant.id, size.id, 'priceCents', Number(e.target.value))}
                                    />
                                  </FormField>
                                  <FormField label={en.admin.stock} htmlFor={`size-stock-${size.id}`}>
                                    <Input
                                      id={`size-stock-${size.id}`}
                                      type="number"
                                      min={-1}
                                      value={size.stock}
                                      onChange={(e) => updateSizeField(variant.id, size.id, 'stock', Number(e.target.value))}
                                    />
                                  </FormField>
                                  <FormField label={en.admin.sku} htmlFor={`size-sku-${size.id}`}>
                                    <Input
                                      id={`size-sku-${size.id}`}
                                      value={size.sku ?? ''}
                                      onChange={(e) => updateSizeField(variant.id, size.id, 'sku', e.target.value)}
                                    />
                                  </FormField>
                                  <div className="flex gap-1 pb-0.5 col-span-2 sm:col-span-1 lg:col-span-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => saveSize(size.id, variant.id)}
                                    >
                                      {en.admin.saved}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive size-9"
                                      onClick={() => deleteSize(variant.id, size.id)}
                                      aria-label={en.admin.deleteSize}
                                    >
                                      <Trash2 className="size-3.5" aria-hidden />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Danger zone */}
      {initial?.product.id && (
        <div className="rounded-lg border border-destructive/30 p-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
          <Button
            variant="destructive"
            size="sm"
            className="w-fit"
            onClick={async () => {
              if (!confirm(en.admin.deleteProductConfirm)) return
              try {
                await apiDelete(`/api/admin/products/${initial.product.id}`)
                toast.success(en.admin.productDeleted)
                router.push('/admin/products')
              } catch {
                toast.error(en.errors.networkError)
              }
            }}
          >
            {en.admin.deleteProduct}
          </Button>
        </div>
      )}
    </div>
  )
}
