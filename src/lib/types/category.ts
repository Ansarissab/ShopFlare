import type { Category, ProductCategory } from 'worker/db/schema'
import type { ProductWithVariants } from './product'

export type { Category, ProductCategory }

// ─── Admin composites ──────────────────────────────────────────────────────────
export type CategoryNode = Category & {
  productCount: number
  children: CategoryNode[]
}

export interface CategoryTreeResponse {
  categories: CategoryNode[]
}

export interface CategoryDetailResponse {
  category: Category
  products: ProductWithVariants[]
  breadcrumb: Category[]
}

// ─── Component prop interfaces (DRY rule 3 — all *Props live here) ─────────────
export interface CategoryNavProps {
  categories: CategoryNode[]
}

export interface CategoryFilterProps {
  categories: CategoryNode[]
  activeSlug: string | null
  onChange: (slug: string | null) => void
}

export interface CategoryFormProps {
  category?: Category
  parentOptions: Category[]
  onSuccess: () => void
}

export interface CategoryTreeProps {
  categories: CategoryNode[]
  onReorder: (categoryId: string, direction: 'up' | 'down') => void
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
}

export interface CategoryImageUploadProps {
  categoryId: string
  currentImageUrl?: string | null
  onUploadComplete: (imageUrl: string) => void
  onRemove: () => void
}

export interface ProductCategoryPickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}
