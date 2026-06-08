# DRY & Reusability Conventions (ENFORCED)

> These are not suggestions. Every PR and every agent must follow them.
> If you find yourself copy-pasting, you are doing it wrong — extract instead.

The codebase is organized around **four reuse layers**. Before writing new code,
check whether it belongs in one of these. Never inline what one of these owns.

---

## 1. Shared / Common Components

UI that appears in more than one place lives in `src/components/store/**`
(or `src/components/ui/**` for shadcn primitives) and is imported — never
re-implemented.

- ✅ `ProductHeroWrapper` is the single cart-wiring container for both the
  single-product and detail pages.
- ❌ Do not duplicate hero/cart/dialog markup per page.
- Composition over duplication: build pages by composing existing components.

## 2. Global Styles / Utilities

| Concern            | Single source of truth            | Rule                                              |
| ------------------ | --------------------------------- | ------------------------------------------------- |
| Layout class combos| `src/lib/styles.ts` (`layout.*`)  | Never repeat `mx-auto max-w-... px-...` inline.   |
| Colors             | `globals.css` CSS vars            | Never hardcode hex (WhatsApp brand green is the only documented exception). |
| Helpers            | `src/lib/utils/index.ts`          | `formatPrice`, `calculateShipping`, `buildProductMaps`, `cn`. One definition each. |
| **Network I/O**    | `src/lib/api.ts`                  | **All** calls go through `apiGet`/`apiPost`. No raw `fetch()`, no per-file `WORKER_URL`. Custom headers → `{ headers }` option. |
| Server-side fetch  | `src/lib/server/fetchFromWorker.ts` | Server components + `generateMetadata` use `fetchFromWorker<T>()`. Never raw `fetch()` with a hardcoded worker URL in a page. |
| UI strings         | `src/lib/i18n/en.ts`              | Never hardcode user-facing text in JSX.           |
| Constants          | `src/lib/constants/index.ts`      | `CURRENCIES`, `ORDER_STATUSES`, `PAYMENT_METHODS`, `DEFAULT_CURRENCY`, `FEATURE_FLAGS`. |
| **Feature flags**  | `src/lib/features.ts` / `worker/lib/features.ts` | Always call `isFeatureEnabled(config, key)`. Never read flag keys inline. |
| **HTML sanitize**  | `src/lib/html.ts` + `src/components/shared/RenderHtml.tsx` | All merchant-authored HTML goes through `sanitizeHtml()`. Never `dangerouslySetInnerHTML` with raw stored HTML. |
| **Image compress** | `src/lib/image.ts` (`compressImage`) | Single compression config for all upload contexts. Never call `browser-image-compression` directly. |
| **Rich text**      | `src/components/shared/RichText.tsx` | Single Trix wrapper. Never instantiate `trix` directly. |
| **SEO metadata**   | `src/lib/seo/metadata.ts` + `src/lib/seo/jsonld.ts` | All JSON-LD builders and `buildPageMetadata` live here. Server pages emit via `<JsonLd>`. |

## 3. Global Type Definitions

All composite types and **all component prop interfaces** live in
`src/lib/types/store.ts`. Components import their `*Props` from there.

- ✅ `import type { ProductHeroProps } from '@/lib/types/store'`
- ❌ `interface ProductHeroProps { ... }` declared inside the component file.
- Base row types are **inferred from Drizzle** (`worker/db/schema.ts`) and
  re-exported — never hand-write a type that mirrors a table.

## 4. Zod Schemas — OOP (Composition & Inheritance), DRY

Single entry point: `src/lib/schemas/` (barrel `index.ts`). Schemas are
**shared by the client and the CF Worker** (worker tsconfig maps `@/* → ../src/*`).
Never redefine validation inline in a route or a form.

```
base.ts     — atomic fields (idField, emailField, phoneField, quantityField…)
              + small reusable objects (orderItemSchema, contactSchema)
order.ts    — order domain (extends/merges base)
product.ts  — product domain
config.ts   — store config
index.ts    — barrel: export * from each
```

Use the four OOP operators instead of repeating fields:

```ts
// INHERIT — extend a base with new fields
export const shippingAddressSchema = contactSchema.extend({
  name: z.string().min(1), address: z.string().min(5), city: z.string().min(1),
  country: z.string().length(2),
})

// COMPOSE — embed one schema as a field of another
export const codOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(50),
  shippingAddress: shippingAddressSchema,
  couponCode: couponField,
})

// PLUCK — derive a form schema from a base (define the base separately so
// .pick() works even when the full schema is a ZodEffect from .refine())
const notifyMeBase = contactSchema.extend({ sizeOptionId: idField })
export const notifyMeSchema     = notifyMeBase.refine(d => d.email || d.phone, …)
export const notifyMeFormSchema = notifyMeBase.pick({ email: true, phone: true })

// PROJECT — strip a field (e.g. server creates orderId, client must not send it)
const clientCheckoutSchema = createCheckoutSessionSchema.omit({ orderId: true })
```

**Worker rule:** routes import schemas from `@/lib/schemas`. The inline
`checkoutBodySchema`/`cancelSchema` duplicates that previously existed have been
removed — do not reintroduce them.

---

## Backend reuse

- DB access helpers and order/product assembly live in `worker/lib/**`
  (`createOrder`, product assembly). Both the COD and Stripe paths call the same
  `createOrder` — order creation is defined once.
- Bindings type and the `parseBody`/`createDb` patterns are consistent across
  routes — copy the shape from `worker/routes/orders.ts`.

## The test

Before adding code, ask: *"Does a base/helper/type/schema for this already
exist?"* If yes, import it. If it almost exists, **extend** it (`.extend`,
`.pick`, `.omit`, `.merge`, a new `layout.*` key, a new util). Only create a new
primitive when nothing composes into it.
