# Phase 34 — Step 0 findings + motion doc

Status: Audit complete (read-only). **No code changed.** Review this before Phase 1.
Method: impeccable deterministic detector (`detect.mjs`) + 3 Sonnet design audits scoped to
landing/shell, product/cart/checkout, and admin. Audited against impeccable's 41 anti-slop rules,
[DESIGN.md](../../../DESIGN.md)'s own 7 rules + motion principles, and project DRY/theming rules.

## Health snapshot

| Surface | Anti-slop verdict | Worst finding |
|---|---|---|
| Landing + shell | Mostly intentional (poster hero is genuinely editorial) | `font-bold` on serif headings; review cards; centered CTA body |
| Product + cart + checkout | Clean structurally | **no-op add-to-cart confirmation**; prices not all mono; grayscale-hover spec unimplemented |
| Admin | Right structure | Recharts colors hardcoded hex → dark-mode breaks; `font-bold` headings; raw `window.confirm`/`reload` |

Deterministic detector hits: flat type hierarchy in `globals.css:116`; "em-dash overuse" flags are
**false positives** (they count em-dashes in code comments, not user-facing copy) — ignore.

## DESIGN.md motion specs — documented vs actually shipped

| Spec | Status |
|---|---|
| Grid entrance (`@starting-style` stagger) | **Shipped** — `globals.css:261-271` + `ProductGrid.tsx:28` |
| Page transitions (`@view-transition`) | **Shipped** — `globals.css:193-237` |
| Hero poster text entrance | **Shipped** — `globals.css:243-253` |
| Add-to-cart confirmation (scale pulse + checkmark) | **NOT shipped** — documented only; spinner is the only feedback |
| Image desaturate on hover (`grayscale(100%)`) | **NOT shipped** — `ProductCard` does scale zoom only |

So two documented brand motions were never built. Phase 1 builds them; that's the "magnetic" core,
not net-new decoration.

## The isAddingToCart bug (Phase 1 anchor)

`ProductActions.tsx:44-49` — when `isAddingToCart` is true the button only swaps the cart icon for a
spinner and disables itself; label never changes, no success state. `ProductHero.tsx:33,128` passes
the prop straight through with no local `added` state to drive a post-success confirmation. Result:
spinner → silently back to "Add to Cart", **zero acknowledgement the item was added.**
Fix in Phase 1: local `added` bool (1.5s timer) in ProductHero → `<Check/>` + label swap in
ProductActions + CSS scale-pulse on the cart icon. Reduced-motion: skip pulse, keep label swap.

## Findings by phase (what Phase 1–3 will fix)

### Phase 2 — anti-slop hardening (mechanical, highest count)

- **`font-bold` on serif h1–h4** (DESIGN.md: "never bold h1–h4"): `StorySection.tsx:22`,
  `CTABand.tsx:13`, `ReviewsStrip.tsx:31`, `FeaturedProductsStrip.tsx:13`, admin
  `page.tsx:150`, `orders/[id]/page.tsx:104`, `AdminPageHeader.tsx:28`, `StatCard.tsx:18`.
- **Prices not mono** (DESIGN rule 6): `CartItem.tsx:60`, `OrderSummary.tsx:67/70/90/93/95`,
  `CartSummary.tsx:101/105/113/127`, `SizePicker.tsx:49`, admin `StatCard.tsx:18`.
- **Hardcoded colors** (theming): `HeroSection.tsx:42` `text-white`; `ProductCard.tsx:159` +
  `VariantSelector.tsx:37` `border-black/10` (breaks dark mode); admin `page.tsx` Recharts hex
  `33-38,219-245` (**P1 — chart illegible in dark mode**); `settings/page.tsx:883` `border-gray-300`.
- **Card overuse** (DESIGN rule 5): `ReviewsStrip.tsx:40-56` reviews-as-card-grid; admin
  `ProductForm.tsx:57-77` nested micro-cards. **Centered body**: `CTABand.tsx:11` whole section
  `text-center`. **Flat type scale**: `globals.css:116`.

### Phase 3 — polish sweep (low-sev cosmetics, same files)

- i18n hardcoded strings: `NotifyMeDialog.tsx:67-69`, `CheckoutMethodSelector.tsx:188-189`,
  `FreeShippingBar.tsx:23` (`!` outside key), admin section headings (`ProductForm.tsx:388,582`,
  `settings/page.tsx:775,833,979`, `orders/[id]/page.tsx:85,87,165`), success-page strings.
- a11y: `ImageCarousel.tsx:59,90` generic alt; `StorySection.tsx:17` alt == heading;
  `FormField.tsx:36` missing `aria-describedby`; `RichTextEditor.tsx:86` `focus:outline-none` kills
  focus ring; `AnnouncementBar.tsx:256,281` focus outline color; `LandingPage.tsx:14` no
  `id="main-content"`; radio-group arrow-keys.
- Loading states: `CheckoutMethodSelector.tsx:162` + `ManualOrderForm.tsx:195` raw `'…'`/`'...'`
  instead of spinner + `aria-busy`.
- Admin UX: `orders/[id]/page.tsx:47,64` `window.location.reload()` → `router.refresh()`;
  raw `window.confirm()` (`ProductForm.tsx:247,729`, `CouponsTable.tsx:22`) → `AlertDialog`;
  raw `<input type=checkbox>` ×8 in settings → shadcn `<Checkbox>`. DRY: `OrderLineItemProps`
  TODO move to `lib/types/store.ts`.

## Motion patterns to reimplement ($0, native CSS only)

All `transform`/`opacity` (+ blur/backdrop where it earns it), `prefers-reduced-motion`-gated, no JS
animation lib. Each communicates something — none is decoration.

1. **Add-to-cart confirmation** — CSS `@keyframes` scale pulse on cart icon + checkmark label swap
   (1.5s). Says "it's in your cart" in-context, no toast. *(the isAddingToCart fix)*
2. **Card hover desaturate** — `motion-safe:group-hover:grayscale` on `ProductCard.tsx:89` alongside
   existing scale. Editorial restraint: pulls the eye to name/price. One Tailwind class. *(DESIGN spec)*
3. **Landing scroll-reveal** — shared `useReveal` (IntersectionObserver) toggles `.reveal-visible` on
   StorySection/ReviewsStrip/CTABand. **Must enhance an already-visible default** (no content gated on
   the class) so headless/hidden-tab renders never ship blank. The page "builds" as you read down.
4. **Hero per-element stagger** — split watermark/headline/subtext/CTA into individual
   `@starting-style` with ~60ms stagger. Communicates reading order; brand anchors first, CTA last.
5. **Sticky-header shrink-on-scroll** — `animation-timeline: scroll(root)` shrinks header `h-16→h-12`
   + `backdrop-filter: blur(8px)` past the hero fold. Pure CSS, no scroll listener. Reclaims space.
6. **FeaturedProductsStrip stagger** — apply existing `.pg-enter` + per-card `transitionDelay` (the
   class already exists; the strip just doesn't use it). Curated picks arrive with intention.

Cart item enter/exit (`@starting-style` translateX) is a nice-to-have if budget allows.

## What's already good (keep, don't touch)

Poster hero gradient veil uses tokens correctly; grid stagger cap (`MAX_STAGGER_MS`) is clean;
`min-h-11` 44px touch targets throughout; `motion-reduce:opacity-100` quick-add (no hidden
affordance); `useSyncExternalStore` hydration guards; RTL logical CSS; i18n coverage near-complete;
`role="radiogroup"` ARIA on checkout; charts share `CHART_TOOLTIP_STYLE`.

## Open decisions for you before Phase 1

1. **Branch + restore tag** (plan's reversibility section, your job — I never create branches):
   `git checkout -b design/magnetic` and `git tag pre-phase-34`. I'm currently on `main`.
2. **Scope of Phase 2/3 sweeps** — do the cosmetic/i18n/admin items ride along (they live in the
   same files as the motion work, per the plan), or stay strictly to motion + anti-slop?
3. **Commits** — you've said no commits without permission; I'll stage per coherent change and wait.
