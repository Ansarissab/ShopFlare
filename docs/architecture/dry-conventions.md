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
| Layout class combos| `src/lib/styles.ts` (`layout.*`)  | Never repeat a multi-class combo inline.          |
| Colors             | `globals.css` CSS vars            | Never hardcode hex (WhatsApp brand green is the only documented exception). |
| Helpers            | `src/lib/utils/index.ts`          | `formatPrice`, `calculateShipping`, `buildProductMaps`, `cn`. One definition each. |
| **Network I/O**    | `src/lib/api.ts`                  | **All** calls go through `apiGet`/`apiPost`. No raw `fetch()`, no per-file `WORKER_URL`. Custom headers → `{ headers }` option. |
| Server-side fetch  | `src/lib/server/fetchFromWorker.ts` | Server components + `generateMetadata` use `fetchFromWorker<T>()`. Never raw `fetch()` with a hardcoded worker URL in a page. |
| UI strings         | `src/lib/i18n/en.ts`              | Never hardcode user-facing text in JSX.           |
| Constants          | `src/lib/constants/index.ts`      | `CURRENCIES`, `ORDER_STATUSES`, `PAYMENT_METHODS`, `DEFAULT_CURRENCY`, `FEATURE_FLAGS`. |
| **Feature flags**  | `src/lib/features.ts` / `worker/lib/features.ts` | Always call `isFeatureEnabled(config, key)`. Never read flag keys inline. |
| **HTML sanitize**  | `src/lib/html.ts` + `src/components/shared/RenderHtml.tsx` | All merchant-authored HTML goes through `sanitizeHtml()`. Never `dangerouslySetInnerHTML` with raw stored HTML. |
| **Image compress** | `src/lib/image.ts` (`compressImage`) | Single compression config for all upload contexts. Never call `browser-image-compression` directly. |
| **Image upload**    | `src/components/shared/ImageUpload.tsx` | All admin image uploads go through this shared component (confirm dialog, hard-block, delete). Never duplicate upload logic per-caller. |
| **Rich text**      | `src/components/shared/RichText.tsx` | Single Trix wrapper. Never instantiate `trix` directly. |
| **SEO metadata**   | `src/lib/seo/metadata.ts` + `src/lib/seo/jsonld.ts` | All JSON-LD builders and `buildPageMetadata` live here. Server pages emit via `<JsonLd>`. |

Shared primitives to reuse (extend, don't re-type):

- `layout.*` (`src/lib/styles.ts`): `formGrid2`, `formGrid2g3`, `landingSection`,
  `emptyState`, `activeRow` (keyboard j/k row highlight), plus the page wrappers.
- Helpers (`src/lib/utils/index.ts`): `shortDay` (ISO → short day label) alongside
  `formatPrice` / `calculateShipping` / `cn`.
- `CHART_TOOLTIP_STYLE` (`src/lib/constants/chart.ts`): the one Recharts tooltip
  `contentStyle` for all admin charts.
- Keyboard shortcuts: engine + bindings are data in `src/lib/constants/shortcuts.ts`;
  the j/k list-nav primitive is `useListNavigation` + `ListNavContext` (register, do
  not re-implement per list).
- Admin page chrome (`src/components/admin/shared/`): every admin page title goes
  through `AdminPageHeader` (sticky bar, optional `actions`/`backHref` slots) — never
  a raw `<h1>`. List loading states use `AdminListSkeleton` (`rows`, optional
  `itemClassName`) — never hand-roll a `flex flex-col gap-2` + `Array.from(...).map(<Skeleton/>)`
  block.
- **Landing templates** (`src/components/store/landing/templates/`): the single switch
  point for landing designs is `LANDING_TEMPLATE_REGISTRY` (`registry.ts`) — a
  `Record<LandingTemplate, ComponentType<LandingTemplateProps>>` exhaustive over the
  template enum. Adding a design = one component + one registry entry. All templates
  compose from the shared kit at `templates/shared/`:
  - `TemplateSection` — section wrapper (padding, background, id anchor).
  - `FeaturedGrid` — product card grid, shared across all templates.
  - `templateKit` (`templateKit.ts`) — type-scale tokens + button-style helpers derived
    from the store's CSS-variable theme. Templates use these tokens; never hardcode hex or
    font sizes.

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
- **Never redeclare a constant/type/helper that already lives in `@/lib`.** The
  worker tsconfig maps `@/* → ../src/*`, so worker code re-exports from the shared
  source (e.g. `worker/lib/analytics.ts` re-exports the RFM constants from
  `@/lib/constants`; routes import `ALLOWED_IMAGE_TYPES`/`MAX_IMAGE_BYTES`,
  `slugify`, `parseTags`, `calculateShipping`, the `PaymentMethod` type). Forking a
  value frontend↔backend silently drifts — re-export instead.

## The test

Before adding code, ask: *"Does a base/helper/type/schema for this already
exist?"* If yes, import it. If it almost exists, **extend** it (`.extend`,
`.pick`, `.omit`, `.merge`, a new `layout.*` key, a new util). Only create a new
primitive when nothing composes into it.
