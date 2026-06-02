// Store config schema — shared by the CF Worker (GET /api/config/store response
// validation) and the client (useStoreConfig). Composed so Admin forms (Phase 2)
// can .pick()/.partial() individual slices instead of redefining fields.
import { z } from 'zod/v4'
import { CURRENCIES } from '@/lib/constants'
import { emailField, phoneField } from './base'

// Derive the currency enum from the single CURRENCIES source (DRY).
const currencyCodes = Object.keys(CURRENCIES) as [string, ...string[]]
export const currencyCodeSchema = z.enum(currencyCodes)

// Monetary amounts are always integer cents, never negative.
const centsField = z.number().int().nonnegative()

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
})

export type StoreConfigData = z.infer<typeof storeConfigSchema>
