// Store config schema — shared by the CF Worker (GET /api/config/store response
// validation) and the client (useStoreConfig). Composed so Admin forms (Phase 2)
// can .pick()/.partial() individual slices instead of redefining fields.
import { z } from 'zod/v4'
import { CURRENCIES, RADIUS_PRESETS, FONT_PRESETS, COLOR_MODES, TAX_BASIS, MIN_PRODUCT_PAGE_SIZE, MAX_PRODUCT_PAGE_SIZE } from '@/lib/constants'
import { emailField, phoneField, hexColorField } from './base'

// Derive the currency enum from the single CURRENCIES source (DRY).
const currencyCodes = Object.keys(CURRENCIES) as [string, ...string[]]
export const currencyCodeSchema = z.enum(currencyCodes)

// Monetary amounts are always integer cents, never negative.
const centsField = z.number().int().nonnegative()

export const appearanceSchema = z.object({
  primaryColor:   hexColorField.optional(),
  primaryColorFg: hexColorField.optional(),
  accentColor:    hexColorField.optional(),
  accentColorFg:  hexColorField.optional(),
  radius:     z.enum(Object.keys(RADIUS_PRESETS) as [string, ...string[]]).optional(),
  fontFamily: z.enum(Object.keys(FONT_PRESETS)  as [string, ...string[]]).optional(),
  colorMode:  z.enum(COLOR_MODES).optional(),
  logoUrl:    z.string().url().optional(),
  logoR2Key:  z.string().optional(),
  faviconUrl:   z.string().url().optional(),
  faviconR2Key: z.string().optional(),
})
export type AppearanceData = z.infer<typeof appearanceSchema>

export const taxConfigSchema = z.object({
  taxEnabled:            z.boolean().optional(),
  taxRate:               z.number().min(0).max(100).optional(),
  taxName:               z.string().min(1).max(30).optional(),
  taxInclusive:          z.boolean().optional(),
  taxBasis:              z.enum(Object.keys(TAX_BASIS) as [string, ...string[]]).optional(),
  taxRegistrationNumber: z.string().max(50).optional(),
})
export type TaxConfigData = z.infer<typeof taxConfigSchema>

export const storeConfigSchema = z.object({
  storeName:                  z.string().min(1),
  tagline:                    z.string().optional(),
  whatsappNumber:             phoneField.optional(),
  contactEmail:               emailField.optional(),
  currency:                   currencyCodeSchema,
  freeShippingThresholdCents: centsField, // 0 = disabled
  flatShippingRateCents:      centsField,
  // Manual bank-transfer payment details. Shown publicly on the thank-you/track
  // page + confirmation email when the customer pays by bank transfer (Shopify
  // "manual payment" model — no card capture, merchant marks the order paid).
  // All optional: when bankAccountNumber is unset the Bank Transfer option hides.
  bankName:           z.string().optional(),
  bankAccountTitle:   z.string().optional(),
  bankAccountNumber:  z.string().optional(),
  bankIban:           z.string().optional(),
  bankInstructions:   z.string().optional(),
  productPageSize: z.number().int().min(MIN_PRODUCT_PAGE_SIZE).max(MAX_PRODUCT_PAGE_SIZE).optional(),
}).merge(appearanceSchema).merge(taxConfigSchema)

export type StoreConfigData = z.infer<typeof storeConfigSchema>
