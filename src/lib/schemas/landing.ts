import { z } from 'zod/v4'
import { LANDING_SECTION_KEYS, LANDING_TEMPLATES } from '@/lib/constants'

// Base fields shared across all sections — all optional; pick per-section below.
export const landingSectionBaseSchema = z.object({
  enabled: z.boolean().optional(),
  heading: z.string().max(200).optional(),
  subtext: z.string().max(500).optional(),
  bodyHtml: z.string().optional(),
  ctaText: z.string().max(100).optional(),
  ctaHref: z
    .string()
    .max(500)
    .regex(
      /^(\/[^\s]*|https?:\/\/[^\s]+)$/i,
      'ctaHref must be a relative path starting with / or an http(s) URL',
    )
    .optional(),
  imageR2Key: z.string().optional(),
})

// Per-section shapes — derived from base via .pick() so there is one truth.

export const heroSectionSchema = landingSectionBaseSchema.pick({
  enabled: true,
  heading: true,
  subtext: true,
  ctaText: true,
  ctaHref: true,
  imageR2Key: true,
})

export const storySectionSchema = landingSectionBaseSchema.pick({
  enabled: true,
  heading: true,
  bodyHtml: true,
  imageR2Key: true,
})

export const featuredSectionSchema = landingSectionBaseSchema.pick({
  enabled: true,
  heading: true,
})

export const reviewsSectionSchema = landingSectionBaseSchema.pick({
  enabled: true,
  heading: true,
})

export const ctaSectionSchema = landingSectionBaseSchema.pick({
  enabled: true,
  heading: true,
  subtext: true,
  ctaText: true,
  ctaHref: true,
})

// Map from section key to its schema (for route-level validation).
export const SECTION_SCHEMAS = {
  hero: heroSectionSchema,
  story: storySectionSchema,
  featured: featuredSectionSchema,
  reviews: reviewsSectionSchema,
  cta: ctaSectionSchema,
} as const

export type LandingSectionInput = z.infer<typeof landingSectionBaseSchema>

// Featured product ordering — ordered list of product IDs.
export const featuredProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).max(20),
})

export type FeaturedProductsInput = z.infer<typeof featuredProductsSchema>

// Section key validation guard.
export const sectionKeySchema = z.enum(LANDING_SECTION_KEYS)

// Landing page management schemas.
export const landingTemplateSchema = z.enum(LANDING_TEMPLATES)

export const landingPageCreateSchema = z.object({
  name: z.string().min(1).max(100),
  template: landingTemplateSchema.optional(),
})

// Partial update — accepts name and/or template; at least one must be provided
// (enforced in the route handler).
export const landingPageRenameSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  template: landingTemplateSchema.optional(),
})

export type LandingPageCreateInput = z.infer<typeof landingPageCreateSchema>
export type LandingPageUpdateInput = z.infer<typeof landingPageRenameSchema>
