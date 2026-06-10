// Shared markdown serializer for product/category/policy content.
// Used by .md route handlers — one serializer, no duplication per page type.

import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryDetailResponse } from '@/lib/types/category'
import type { StorePage } from '@/lib/types/admin'
import type { StoreConfig } from '@/lib/types/common'

// Strip HTML tags for plain-text markdown output.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function productToMarkdown(
  item: ProductWithVariants,
  config: StoreConfig | null,
  opts: { siteUrl: string },
): string {
  const { product, variants } = item
  const { siteUrl } = opts
  const currency = config?.currency ?? 'USD'
  const lines: string[] = []

  lines.push(`# ${product.name}`)
  if (product.description) lines.push('', stripHtml(product.description))

  // Price range — SizeOption uses priceCents; stock -1 means unlimited
  const prices = variants
    .flatMap((v) => v.sizes)
    .filter((s) => s.active && s.stock !== 0)
    .map((s) => s.priceCents)
  if (prices.length > 0) {
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const fmt = (p: number) => `${currency} ${(p / 100).toFixed(2)}`
    lines.push('', min === max ? `**Price:** ${fmt(min)}` : `**Price:** ${fmt(min)} – ${fmt(max)}`)
  }

  const hasStock = variants.flatMap((v) => v.sizes).some((s) => s.active && s.stock !== 0)
  lines.push(`**Availability:** ${hasStock ? 'In Stock' : 'Out of Stock'}`)

  if (siteUrl) lines.push('', `[View product](${siteUrl}/product/${product.id})`)

  return lines.join('\n')
}

export function categoryToMarkdown(
  data: CategoryDetailResponse,
  _config: StoreConfig | null,
  opts: { siteUrl: string },
): string {
  const { category, products } = data
  const { siteUrl } = opts
  const lines: string[] = []

  lines.push(`# ${category.name}`)
  if (category.description) lines.push('', stripHtml(category.description))
  lines.push('', `**Products:** ${products.length}`)

  for (const item of products.slice(0, 20)) {
    const slug = item.product.id
    const link = siteUrl ? `[${item.product.name}](${siteUrl}/product/${slug})` : item.product.name
    lines.push(`- ${link}`)
  }

  return lines.join('\n')
}

export function policyToMarkdown(page: StorePage): string {
  const lines: string[] = []
  lines.push(`# ${page.title}`)
  if (page.updatedAt) lines.push(`*Last updated: ${page.updatedAt}*`)
  if (page.content) {
    lines.push(
      '',
      page.content.trimStart().startsWith('<') ? stripHtml(page.content) : page.content,
    )
  }
  return lines.join('\n')
}
