// Single entry point for all Zod schemas.
// Import from here — never from sub-modules directly.
//
// Architecture:
//   base.ts    — atomic field primitives (idField, quantityField, contactSchema…)
//   order.ts   — order domain: shippingAddress, codOrder, checkoutSession, cancel
//   product.ts — product domain: review, notifyMe
//
// Pattern cheat-sheet:
//   Extend (inherit):  shippingAddressSchema = contactSchema.extend({...})
//   Compose (merge):   codOrderSchema uses shippingAddressSchema as a field
//   Pluck  (pick):     someFormSchema = someBase.pick({ field: true })
//   Omit   (project):  someSchema.omit({ sensitiveField: true })

export * from './base'
export * from './order'
export * from './product'
export * from './config'
export * from './admin'
