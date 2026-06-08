'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, Minus, Trash2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/common/FormField'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { buildWhatsAppOrderUrl } from '@/lib/whatsapp'
import { isFeatureEnabled } from '@/lib/features'
import { apiPost } from '@/lib/api'
import { useApiResource } from '@/hooks/useApiResource'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import type { ProductWithVariants, VariantWithDetails, SizeOption } from '@/lib/types/product'
import type { POSSaleItem } from '@/lib/types/admin'

interface ProductsResponse {
  products: ProductWithVariants[]
}

export function POSScreen() {
  const { data, loading } = useApiResource<ProductsResponse>('/api/products')
  const { config } = useStoreConfig()

  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [selectedSizeId, setSelectedSizeId] = useState<string>('')
  const [saleItems, setSaleItems] = useState<POSSaleItem[]>([])
  const [customerPhone, setCustomerPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [completedOrderNumber, setCompletedOrderNumber] = useState<string | null>(null)

  const products = data?.products ?? []

  const selectedProduct = products.find((p) => p.product.id === selectedProductId)
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === selectedVariantId) as VariantWithDetails | undefined
  const selectedSize = selectedVariant?.sizes.find((s) => s.id === selectedSizeId) as SizeOption | undefined

  function handleAddToSale() {
    if (!selectedProduct || !selectedVariant || !selectedSize) return

    const existing = saleItems.find((i) => i.sizeOptionId === selectedSize.id)
    if (existing) {
      setSaleItems((prev) =>
        prev.map((i) =>
          i.sizeOptionId === selectedSize.id ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      )
    } else {
      const firstImage = selectedVariant.images[0]?.url ?? ''
      setSaleItems((prev) => [
        ...prev,
        {
          sizeOptionId: selectedSize.id,
          productId: selectedProduct.product.id,
          variantId: selectedVariant.id,
          productName: selectedProduct.product.name,
          variantLabel: selectedVariant.label,
          size: selectedSize.size,
          sku: selectedSize.sku ?? undefined,
          priceCents: selectedSize.priceCents,
          imageUrl: firstImage,
          quantity: 1,
        },
      ])
    }

    // Reset size picker
    setSelectedSizeId('')
  }

  function adjustQuantity(sizeOptionId: string, delta: number) {
    setSaleItems((prev) =>
      prev
        .map((i) => (i.sizeOptionId === sizeOptionId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    )
  }

  const subtotalCents = saleItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)

  async function completeSale() {
    if (saleItems.length === 0) return
    setSubmitting(true)
    try {
      const { orderNumber } = await apiPost<{ orderId: string; orderNumber: string }>(
        '/api/admin/orders/pos',
        {
          items: saleItems.map((i) => ({ sizeOptionId: i.sizeOptionId, quantity: i.quantity })),
          customerPhone: customerPhone.trim() || undefined,
        },
      )
      setCompletedOrderNumber(orderNumber)
      setSaleItems([])
      setCustomerPhone('')
      toast.success(en.pos.saleCompleted)
    } catch {
      toast.error(en.errors.orderFailed)
    } finally {
      setSubmitting(false)
    }
  }

  function handleSendWhatsApp(_orderNumber: string) {
    if (!isFeatureEnabled(config, 'whatsappEnabled') || !config?.whatsappNumber) return
    const firstItem = saleItems[0]
    if (!firstItem) return
    const url = buildWhatsAppOrderUrl({
      phoneNumber: config.whatsappNumber,
      productName: firstItem.productName,
      variantLabel: firstItem.variantLabel,
      size: firstItem.size,
      sku: firstItem.sku,
      priceCents: subtotalCents,
      currency: config.currency,
      quantity: saleItems.reduce((s, i) => s + i.quantity, 0),
    })
    window.open(url, '_blank')
  }

  if (completedOrderNumber) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-16 text-[--color-success]" strokeWidth={1.5} aria-hidden />
        <h2 className="text-xl font-bold">{en.pos.saleCompleted}</h2>
        <p className="text-muted-foreground font-mono">
          {en.pos.orderNumber.replace('{number}', completedOrderNumber)}
        </p>
        <div className="flex gap-3">
          {isFeatureEnabled(config, 'whatsappEnabled') && config?.whatsappNumber && (
            <Button variant="outline" onClick={() => handleSendWhatsApp(completedOrderNumber)}>
              {en.pos.sendWhatsApp}
            </Button>
          )}
          <Button onClick={() => setCompletedOrderNumber(null)}>
            {en.pos.newSale}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      {/* Left: product selector */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">{en.pos.selectProduct}</h2>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{en.pos.noProducts}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Product */}
            <Select value={selectedProductId} onValueChange={(v: string | null) => {
              setSelectedProductId(v ?? '')
              setSelectedVariantId('')
              setSelectedSizeId('')
            }}>
              <SelectTrigger aria-label={en.pos.selectProduct}>
                <SelectValue placeholder={en.pos.selectProduct} />
              </SelectTrigger>
              <SelectContent>
                {products.map(({ product }) => (
                  <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Variant */}
            {selectedProduct && (
              <Select value={selectedVariantId} onValueChange={(v: string | null) => {
                setSelectedVariantId(v ?? '')
                setSelectedSizeId('')
              }}>
                <SelectTrigger aria-label={en.pos.selectVariant}>
                  <SelectValue placeholder={en.pos.selectVariant} />
                </SelectTrigger>
                <SelectContent>
                  {selectedProduct.variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.colorHex && (
                        <span
                          className="inline-block size-3 rounded-full mr-1.5 border align-middle"
                          style={{ backgroundColor: v.colorHex }}
                          aria-hidden
                        />
                      )}
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Size */}
            {selectedVariant && (
              <Select value={selectedSizeId} onValueChange={(v: string | null) => setSelectedSizeId(v ?? '')}>
                <SelectTrigger aria-label={en.pos.selectSize}>
                  <SelectValue placeholder={en.pos.selectSize} />
                </SelectTrigger>
                <SelectContent>
                  {selectedVariant.sizes.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={s.stock === 0}>
                      {s.size} — {formatPrice(s.priceCents, config?.currency)}
                      {s.stock === 0 && <Badge variant="destructive" className="ml-2 text-xs">{en.store.outOfStock}</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={handleAddToSale}
              disabled={!selectedSize}
              size="sm"
            >
              <Plus className="size-4 mr-1.5" aria-hidden />
              {en.pos.addToSale}
            </Button>
          </div>
        )}
      </div>

      {/* Right: sale summary */}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">{en.pos.currentSale}</h2>

        {saleItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No items added.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {saleItems.map((item) => (
              <li key={item.sizeOptionId} className="flex items-center gap-3">
                {item.imageUrl && (
                  <div className="relative size-10 rounded-md overflow-hidden border shrink-0">
                    <Image src={item.imageUrl} alt="" fill className="object-cover" sizes="40px" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.variantLabel} · {item.size}</p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    onClick={() => adjustQuantity(item.sizeOptionId, -1)}
                  >
                    <Minus className="size-3" aria-hidden />
                  </Button>
                  <span className="w-5 text-center text-sm">{item.quantity}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    onClick={() => adjustQuantity(item.sizeOptionId, 1)}
                  >
                    <Plus className="size-3" aria-hidden />
                  </Button>
                </div>
                <span className="text-sm font-medium w-16 sm:w-20 text-right whitespace-nowrap">
                  {formatPrice(item.priceCents * item.quantity, config?.currency)}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground"
                  onClick={() => setSaleItems((prev) => prev.filter((i) => i.sizeOptionId !== item.sizeOptionId))}
                  aria-label="Remove"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Separator />

        <div className="flex justify-between text-sm font-semibold">
          <span>{en.cart.total}</span>
          <span>{formatPrice(subtotalCents, config?.currency)}</span>
        </div>

        <FormField label={en.pos.customerPhone} htmlFor="pos-phone" help={en.tooltips.pos.customerPhone}>
          <Input
            id="pos-phone"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+92 300 0000000"
          />
        </FormField>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setSaleItems([])}
            disabled={saleItems.length === 0}
          >
            {en.pos.clearSale}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={completeSale}
            disabled={saleItems.length === 0 || submitting}
          >
            {submitting ? '…' : en.pos.completeSale}
          </Button>
        </div>
      </div>
    </div>
  )
}
