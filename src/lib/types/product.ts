import type * as React from 'react'
import type { Product, Variant, SizeOption, ProductImage } from 'worker/db/schema'
import type { CurrencyCode } from '@/lib/constants'

export type { Product, Variant, SizeOption, ProductImage }

export type VariantWithDetails = Variant & {
  images: ProductImage[]
  sizes: SizeOption[]
}

export type ProductWithVariants = {
  product: Product
  variants: VariantWithDetails[]
  categoryIds: string[]
  /** Parsed FAQ items (phase 30). Empty array when none stored. */
  faqItems: { question: string; answer: string }[]
}

export interface WhatsAppOrderParams {
  phoneNumber: string
  productName: string
  variantLabel: string
  size: string
  sku?: string
  priceCents: number
  currency: CurrencyCode
  quantity: number
}

export interface ImageCarouselProps {
  images: ProductImage[]
  className?: string
}

export interface VariantSelectorProps {
  variants: Variant[]
  selectedVariantId: string
  onSelect: (id: string) => void
  className?: string
}

export interface SizePickerProps {
  sizes: SizeOption[]
  selectedSizeId: string | null
  onSelect: (id: string) => void
  className?: string
}

export interface ProductActionsProps {
  product: Product
  selectedVariant: Variant | null
  selectedSize: SizeOption | null
  allSizesOOS: boolean
  isAddingToCart: boolean
  /** True for ~1.5s after a successful add — shows the Check icon + "Added" label. */
  isAdded?: boolean
  showWhatsApp: boolean
  onAddToCart: () => void
  onBuyNow: () => void
  onWhatsApp: () => void
  onCOD: () => void
  onNotifyMe: () => void
  className?: string
}

export interface ProductCardProps {
  product: Product
  variants: Variant[]
  sizes: SizeOption[]
  images: ProductImage[]
  isNew?: boolean
  className?: string
  /** Inline styles forwarded to the root element (e.g. transition-delay for stagger) */
  style?: React.CSSProperties
  /**
   * When true, the product image is loaded eagerly with fetchpriority=high (Next.js `priority`).
   * Pass for the first few above-the-fold cards to improve LCP; leave false for the rest.
   */
  priority?: boolean
}

export interface ProductHeroProps {
  product: Product
  variants: Variant[]
  sizesByVariant: Record<string, SizeOption[]>
  imagesByVariant: Record<string, ProductImage[]>
  currency: CurrencyCode
  isNew?: boolean
  isPopular?: boolean
  showWhatsApp: boolean
  onAddToCart: (sizeOption: SizeOption) => void
  onBuyNow: (sizeOption: SizeOption) => void
  onWhatsApp: (sizeOption: SizeOption) => void
  onCOD: (sizeOption: SizeOption) => void
  isAddingToCart?: boolean
  /** True for ~1.5s after a successful add — drives the confirmation state in ProductActions. */
  isAdded?: boolean
  className?: string
}

export interface ProductHeroWrapperProps {
  item: ProductWithVariants
}

export interface NotifyMeDialogProps {
  sizeOptionId: string
  productName: string
  size: string
  variantLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export interface WhatsAppButtonProps {
  phoneNumber: string
  productName: string
  variantLabel: string
  size: string
  sku?: string
  priceCents: number
  currency: CurrencyCode
  quantity?: number
  disabled?: boolean
}

// Reviews
export interface ProductReview {
  id: string
  customerName: string
  rating: number
  body: string | null
  createdAt: string
}

export interface ProductReviewsResponse {
  reviews: ProductReview[]
  average: number
  count: number
}

export interface ReviewStarsProps {
  rating: number
  onChange?: (rating: number) => void
  className?: string
}

export interface ReviewsSectionProps {
  productId: string
  productName: string
  reviewsEnabled?: boolean
  className?: string
}

export interface ReviewFormProps {
  productId: string
  productName: string
  onSubmitted: () => void
}
