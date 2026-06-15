// Store config schema — shared by the CF Worker (GET /api/config/store response
// validation) and the client (useStoreConfig). Composed so Admin forms (Phase 2)
// can .pick()/.partial() individual slices instead of redefining fields.
import { z } from 'zod/v4'
import {
  CURRENCIES,
  RADIUS_PRESETS,
  FONT_PRESETS,
  COLOR_MODES,
  DENSITY_PRESETS,
  HERO_STYLES,
  TAX_BASIS,
  MIN_PRODUCT_PAGE_SIZE,
  MAX_PRODUCT_PAGE_SIZE,
  SHIPPED_LOCALES,
  ANNOUNCEMENT_TYPES,
  MAX_ANNOUNCEMENT_MESSAGES,
  GA4_ID_RE,
  GOOGLE_ADS_ID_RE,
  META_PIXEL_ID_RE,
} from '@/lib/constants'

import { emailField, phoneField, hexColorField } from './base'

// ─── FAQ item schema (phase 30) ───────────────────────────────────────────────
// Shared by store-wide FAQ (store_config.faqItems) and per-product FAQ
// (products.faqItems). Both scopes use the same item shape.

export const faqItemSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1),
})
export const faqItemsSchema = z.array(faqItemSchema).max(50)

export type FaqItemData = z.infer<typeof faqItemSchema>
export type FaqItemsData = z.infer<typeof faqItemsSchema>

export const featureFlagsSchema = z.object({
  whatsappEnabled: z.boolean().optional(),
  reviewsEnabled: z.boolean().optional(),
  landingEnabled: z.boolean().optional(),
  blogEnabled: z.boolean().optional(),
  llmDiscoveryEnabled: z.boolean().optional(),
  faqEnabled: z.boolean().optional(),
})

// Derive the currency enum from the single CURRENCIES source (DRY).
const currencyCodes = Object.keys(CURRENCIES) as [string, ...string[]]
export const currencyCodeSchema = z.enum(currencyCodes)

// Locale code enum derived from the SHIPPED_LOCALES registry (DRY).
const localeCodeSchema = z.enum([...SHIPPED_LOCALES] as [string, ...string[]])

// Monetary amounts are always integer cents, never negative.
const centsField = z.number().int().nonnegative()

export const appearanceSchema = z.object({
  primaryColor: hexColorField.optional(),
  primaryColorFg: hexColorField.optional(),
  accentColor: hexColorField.optional(),
  accentColorFg: hexColorField.optional(),
  radius: z.enum(Object.keys(RADIUS_PRESETS) as [string, ...string[]]).optional(),
  fontFamily: z.enum(Object.keys(FONT_PRESETS) as [string, ...string[]]).optional(),
  colorMode: z.enum(COLOR_MODES).optional(),
  density: z.enum(Object.keys(DENSITY_PRESETS) as [string, ...string[]]).optional(),
  heroStyle: z.enum(HERO_STYLES).optional(),
  logoUrl: z.string().url().optional(),
  logoR2Key: z.string().optional(),
  faviconUrl: z.string().url().optional(),
  faviconR2Key: z.string().optional(),
})
export type AppearanceData = z.infer<typeof appearanceSchema>

export const taxConfigSchema = z.object({
  taxEnabled: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxName: z.string().min(1).max(30).optional(),
  taxInclusive: z.boolean().optional(),
  taxBasis: z.enum(Object.keys(TAX_BASIS) as [string, ...string[]]).optional(),
  taxRegistrationNumber: z.string().max(50).optional(),
})
export type TaxConfigData = z.infer<typeof taxConfigSchema>

// ─── Announcement Bar ────────────────────────────────────────────────────────

export const announcementMessageSchema = z.object({
  text: z.string().min(1).max(200),
  // Only http(s) URLs and root-relative paths are allowed.
  // This blocks javascript:, data:, vbscript:, and similar XSS vectors.
  link: z
    .string()
    .max(300)
    .regex(/^(https?:\/\/|\/)/, 'Link must be an http/https URL or a root-relative path (/…)')
    .optional(),
  color: hexColorField.optional(),
})
export type AnnouncementMessage = z.infer<typeof announcementMessageSchema>

export const announcementConfigSchema = z.object({
  announcementEnabled: z.boolean().optional(),
  announcementType: z.enum([...ANNOUNCEMENT_TYPES] as [string, ...string[]]).optional(),
  announcementMessages: z
    .array(announcementMessageSchema)
    .max(MAX_ANNOUNCEMENT_MESSAGES)
    .optional(),
  announcementStart: z.string().optional(),
  announcementEnd: z.string().optional(),
  announcementVersion: z.number().int().nonnegative().optional(),
})
export type AnnouncementConfigData = z.infer<typeof announcementConfigSchema>

// ─── Marketing ───────────────────────────────────────────────────────────────
// customHeadTags: the refine is an early-feedback gate for admin forms (reject
// obvious script injection). The real render-time gate is sanitizeHeadTags()
// in src/lib/seo/headTags.ts — always call that in layout.tsx.
//
// Architecture note: marketingSchema is the raw ZodObject so it can be .merge()'d
// onto storeConfigSchema. The customHeadTags XSS refine lives on storeConfigSchema
// itself (after merge) following the same pattern as the locale invariants on
// updateConfigSchema in admin.ts.

export const marketingSchema = z.object({
  googleSiteVerification: z.string().max(200).default(''),
  bingSiteVerification: z.string().max(200).default(''),
  customHeadTags: z.string().max(4000).default(''),
  ga4MeasurementId: z
    .string()
    .max(32)
    .refine((v) => v === '' || GA4_ID_RE.test(v), 'Must be a GA4 ID like G-XXXX')
    .default(''),
  googleAdsId: z
    .string()
    .max(32)
    .refine((v) => v === '' || GOOGLE_ADS_ID_RE.test(v), 'Must be a Google Ads ID like AW-XXXX')
    .default(''),
  metaPixelId: z
    .string()
    .max(32)
    .refine((v) => v === '' || META_PIXEL_ID_RE.test(v), 'Meta Pixel ID is numeric')
    .default(''),
  cookieConsentEnabled: z.boolean().default(true),
  indexNowKey: z
    .string()
    .regex(/^[a-zA-Z0-9-]{0,128}$/, 'IndexNow key is hex/alphanumeric')
    .default(''),
})

export type MarketingConfig = z.infer<typeof marketingSchema>

export const storeConfigSchema = z
  .object({
    storeName: z.string().min(1),
    tagline: z.string().optional(),
    whatsappNumber: phoneField.optional(),
    contactEmail: emailField.optional(),
    currency: currencyCodeSchema,
    freeShippingThresholdCents: centsField, // 0 = disabled
    flatShippingRateCents: centsField,
    // Manual bank-transfer payment details. Shown publicly on the thank-you/track
    // page + confirmation email when the customer pays by bank transfer (Shopify
    // "manual payment" model — no card capture, merchant marks the order paid).
    // All optional: when bankAccountNumber is unset the Bank Transfer option hides.
    bankName: z.string().optional(),
    bankAccountTitle: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankIban: z.string().optional(),
    bankInstructions: z.string().optional(),
    productPageSize: z
      .number()
      .int()
      .min(MIN_PRODUCT_PAGE_SIZE)
      .max(MAX_PRODUCT_PAGE_SIZE)
      .optional(),
    // deprecated: migrated to faqItems (phase 30)
    faqContent: z.string().optional(),
    faqItems: faqItemsSchema.optional(),
    aiTrainingAllowed: z.boolean().optional(),
    enabledLocales: z.array(localeCodeSchema).optional(),
    defaultLocale: localeCodeSchema.optional(),
  })
  .merge(appearanceSchema)
  .merge(taxConfigSchema)
  .merge(featureFlagsSchema)
  .merge(announcementConfigSchema)
  .merge(marketingSchema)

export type StoreConfigData = z.infer<typeof storeConfigSchema>
