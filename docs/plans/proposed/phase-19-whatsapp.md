# Plan 19 — WhatsApp: optional + admin-toggleable + floating widget

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY rules.
> UI strings live in [`src/lib/i18n/en.ts`](../../../src/lib/i18n/en.ts) — never hardcode
> text in JSX. All network I/O via [`src/lib/api.ts`](../../../src/lib/api.ts) — no raw
> `fetch()`. Colors via CSS vars (one precedented exception below). Do **not** `git push`
> or open a PR. Small, focused conventional commits per §6.
>
> **Depends on Phase 17 (reference + reuse — do NOT re-define here):**
> `isFeatureEnabled(config, 'whatsappEnabled')` from `src/lib/features.ts` (client) plus the
> worker mirror, `FEATURE_FLAGS` in [`src/lib/constants/index.ts`](../../../src/lib/constants/index.ts)
> (with `whatsappEnabled` default `false`), and `whatsappEnabled` added to `storeConfigSchema`
> in [`src/lib/schemas/`](../../../src/lib/schemas/). Phase 19 **consumes** these. If Phase 17
> is not yet merged, it is a hard prerequisite — do not re-implement the flag plumbing here.

---

## 1. Goal

Make WhatsApp an **optional, merchant-controlled** capability and add a **floating chat
widget** to the storefront. Three surfaces, all gated by the same `whatsappEnabled` Feature
Flag (Phase 17) **and** the presence of a WhatsApp number:

1. **Floating WhatsApp Widget** — a persistent button bottom-corner on **every** storefront
   page, opening a generic `wa.me` chat with the merchant ("Hi, I have a question about your
   store"). `wa.me` deep-link, $0, white-label.
2. **Admin on/off toggle** — `whatsappEnabled`. When **OFF**, hide **all** WhatsApp UI
   (floating widget + per-product Order button + POS receipt button) regardless of number.
   When **ON + number set**, show.
3. **Per-product "Order on WhatsApp" button** — keep the existing pre-filled
   product/variant/size flow, now gated by the same flag.

Brand green `#25D366` is an intentional, already-precedented CSS-var exception for WhatsApp
chrome (the per-product button icon already uses WhatsApp branding).

---

## 2. Current state (verified file:line refs)

- WhatsApp is **fully built but ALWAYS-ON** — no flag, gated only by `whatsappNumber` presence.
- URL builder: [`src/lib/whatsapp.ts:5-25`](../../../src/lib/whatsapp.ts) `buildWhatsAppOrderUrl(params)`
  builds the `wa.me` URL from `en.whatsapp.*` strings (greeting/product/variant/size/sku/qty/price/footer).
- Per-product button: [`src/components/store/product/ProductActions.tsx:67-89`](../../../src/components/store/product/ProductActions.tsx)
  (renders only when a size is selected, `hasSelection`); wired via
  [`src/components/store/product/ProductHeroWrapper.tsx:78-100`](../../../src/components/store/product/ProductHeroWrapper.tsx)
  (`handleWhatsApp`; errors if no `whatsappNumber`). Button presentation in
  [`src/components/store/product/WhatsAppButton.tsx`](../../../src/components/store/product/WhatsAppButton.tsx).
- POS receipt button: [`src/components/admin/pos/POSScreen.tsx:110,136`](../../../src/components/admin/pos/POSScreen.tsx)
  (`handleSendWhatsApp` + the success-screen button, both gated on `config?.whatsappNumber`).
- Checkout method selector mentions WhatsApp (info text only):
  [`src/components/store/checkout/CheckoutMethodSelector.tsx`](../../../src/components/store/checkout/CheckoutMethodSelector.tsx).
- Admin WhatsApp number field: [`src/app/(admin)/admin/settings/page.tsx:530-533`](../../../src/app/(admin)/admin/settings/page.tsx)
  (Contact section, `whatsappNumber` state, persisted via PUT `/api/admin/config/store`).
- Storefront layout (widget mount point): [`src/app/(store)/layout.tsx:15-37`](../../../src/app/(store)/layout.tsx)
  — children inside `<main>`, siblings `InstallPrompt` / `OfflineBanner` (good precedent for a
  global floating overlay).
- Config fetched client-side via [`src/hooks/useStoreConfig.ts`](../../../src/hooks/useStoreConfig.ts).
- `payment_method` enum already includes `'whatsapp'` ([`worker/db/schema.ts`](../../../worker/db/schema.ts)).
- CONTEXT.md **WhatsApp Widget** term already added (verified, `CONTEXT.md:96`) — keep in sync.

---

## 3. Deliverables

### 3.1 Layer map

| Concern | File | New? | Notes |
|---|---|---|---|
| Floating widget | `src/components/store/WhatsAppWidget.tsx` | **new** | gated by `isFeatureEnabled` + number |
| Mount point | `src/app/(store)/layout.tsx` | edit | add `<WhatsAppWidget />` alongside `InstallPrompt` |
| Generic URL builder | `src/lib/whatsapp.ts` | edit | add `buildWhatsAppContactUrl()` (DRY) |
| Gate per-product button | `ProductActions.tsx` / `ProductHeroWrapper.tsx` | edit | flag + number gate |
| Gate POS button | `POSScreen.tsx` | edit | flag + number gate |
| Admin toggle | `src/app/(admin)/admin/settings/page.tsx` | edit | "Enable WhatsApp" checkbox |
| Strings | `src/lib/i18n/en.ts` | edit | widget label, greeting, toggle label |

### 3.2 (a) Floating widget — `src/components/store/WhatsAppWidget.tsx`

- Client component (`'use client'`); reads config via `useStoreConfig()`.
- **Gate:** render `null` unless `isFeatureEnabled(config, 'whatsappEnabled')` **AND**
  `config.whatsappNumber` is set. (Belt-and-suspenders with the layout; component owns its
  own gate so it is safe to mount unconditionally.)
- Renders a fixed-position anchor/button bottom-corner (e.g. `fixed bottom-4 right-4 z-…`),
  WhatsApp brand green `#25D366` (the documented CSS-var exception — add an inline style or a
  scoped `--color-whatsapp` token rather than a random hex sprinkled in JSX; reuse the
  precedent already set by `WhatsAppButton.tsx`).
- `onClick` (or `href`) opens `buildWhatsAppContactUrl(config.whatsappNumber)` in a new tab
  (`window.open(url, '_blank', 'noopener,noreferrer')`, matching existing usage at
  `ProductHeroWrapper.tsx:97`).
- Label/`aria-label` from `en` (§3.6). Must **not** cover content/CTAs on mobile (§5).
- DRY: do **not** duplicate the gate logic — call `isFeatureEnabled` (Phase 17), do not
  re-derive flag defaults.

### 3.3 (b) Generic contact-URL builder — `src/lib/whatsapp.ts`

Add a second, **smaller** builder beside `buildWhatsAppOrderUrl` (extend the module, don't
copy-paste the `wa.me` assembly):

```ts
export function buildWhatsAppContactUrl(phoneNumber: string): string {
  const message = en.whatsapp.contactGreeting
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
}
```

- Greeting text comes from `en.whatsapp.contactGreeting` (§3.6) — never inline the string.
- If the `wa.me/${phone}?text=${encodeURIComponent(...)}` assembly is worth sharing, extract a
  tiny private `waUrl(phone, message)` helper and have **both** builders call it (DRY); keep
  the public signatures unchanged.

### 3.4 (c) Gate the existing two buttons on the flag

- **Per-product button** ([`ProductActions.tsx:67-89`](../../../src/components/store/product/ProductActions.tsx)):
  the WhatsApp button currently renders whenever `hasSelection`. Add a `showWhatsApp` prop
  (computed in `ProductHeroWrapper.tsx` from `isFeatureEnabled(config,'whatsappEnabled') &&
  !!config.whatsappNumber`) and render the WhatsApp button only when
  `hasSelection && showWhatsApp`. Keep COD button unaffected. Prop type goes in
  [`src/lib/types/store.ts`](../../../src/lib/types/store.ts) (DRY — no per-file `*Props`).
- **POS button** ([`POSScreen.tsx:110,136`](../../../src/components/admin/pos/POSScreen.tsx)):
  change both the early return in `handleSendWhatsApp` and the success-screen button condition
  from `config?.whatsappNumber` to `isFeatureEnabled(config,'whatsappEnabled') &&
  config?.whatsappNumber`.
- Pre-fill behavior of the per-product button is **unchanged** — still calls
  `buildWhatsAppOrderUrl` with product/variant/size/sku/price/qty.

### 3.5 (d) Admin settings — "Enable WhatsApp" checkbox

- In [`settings/page.tsx`](../../../src/app/(admin)/admin/settings/page.tsx) **Contact**
  section (line ~528, next to the WhatsApp number field), add a checkbox/switch bound to a
  `whatsappEnabled` boolean state, defaulting from `config.whatsappEnabled`.
- Persist it through the **existing** PUT `/api/admin/config/store` save (same submit handler
  + same `apiPut` call the page already uses for `whatsappNumber`) — no new endpoint, no raw
  `fetch`. `whatsappEnabled` rides in the same store-config payload (Phase 17 added it to
  `storeConfigSchema`, so it validates on both client and worker).
- Label from `en.admin.enableWhatsApp` (§3.6). Consider a hint that the number must also be
  set for anything to show.

### 3.6 (e) Strings — `src/lib/i18n/en.ts`

Add (names indicative; keep existing keys):
- `en.store.whatsappWidgetLabel` — e.g. `"Chat on WhatsApp"` (used as widget `aria-label`/tooltip).
- `en.whatsapp.contactGreeting` — e.g. `"Hi, I have a question about your store"` (generic
  greeting for the floating widget; **distinct** from the existing order `greeting`).
- `en.admin.enableWhatsApp` — e.g. `"Enable WhatsApp"` (+ optional `enableWhatsAppHint`).

No hardcoded UI text anywhere in the new/edited components.

---

## 4. Schema / DB

**None.** `whatsappEnabled` is a Store Config key, not a column — it lives in the existing
config blob and was added to `storeConfigSchema` + `FEATURE_FLAGS` by **Phase 17**. No D1
migration, no `db/schema.ts` change. (See **Dynamic-First Rule** in CLAUDE.md — toggled from
the Admin Dashboard, no redeploy.)

---

## 5. Accessibility

- Widget is a real `<a>`/`<button>` with a descriptive `aria-label` (`en.store.whatsappWidgetLabel`),
  keyboard-focusable, visible focus ring, Enter/Space activates.
- Icon-only → `aria-hidden` on the SVG, label via `aria-label`.
- **Must not cover content or CTAs on mobile:** ensure it does not overlap the `AppTabBar`
  (`src/components/store/shell/AppTabBar.tsx`) in standalone/mobile — offset bottom spacing so
  both remain tappable; respect safe-area insets. Adequate tap target (≥44px).
- Sufficient contrast: white glyph on `#25D366` passes; verify.
- Covered by the a11y sweep from Phase 16 (`e2e/a11y.spec.ts`) once the widget renders.

---

## 6. Rollout (small commits)

1. `feat(whatsapp): add buildWhatsAppContactUrl generic greeting builder`
2. `feat(i18n): add WhatsApp widget label, contact greeting, enable-toggle strings`
3. `feat(store): floating WhatsAppWidget gated by flag + number; mount in (store) layout`
4. `feat(store): gate per-product Order-on-WhatsApp button on whatsappEnabled flag`
5. `feat(admin): gate POS receipt WhatsApp button on whatsappEnabled flag`
6. `feat(admin): Enable WhatsApp toggle in settings Contact section (PUT config/store)`
7. `test: gating regression tests for all three WhatsApp surfaces`
8. `docs(whatsapp): document toggle + floating widget; verify CONTEXT term; mark phase-19 done`

Each commit must keep `pnpm verify` green before moving on.

---

## 7. Acceptance

- **Flag OFF** → no WhatsApp UI anywhere: no floating widget, no per-product button, no POS
  button — regardless of whether a number is set.
- **Flag ON + no number** → still hidden (number-presence gate holds); admin settings makes
  clear a number is required.
- **Flag ON + number set** → floating widget appears on **every** storefront route (home,
  product, category, cart, checkout, tracking, policy), opening `wa.me` with the generic
  greeting; per-product button reappears and **still pre-fills** product/variant/size/sku/
  price/qty via `buildWhatsAppOrderUrl`; POS receipt button reappears.
- Toggle **round-trips**: enable in admin → save (PUT `/api/admin/config/store`) → reload →
  still enabled; disable → all surfaces vanish.
- Regression tests cover the gating matrix (off / on-no-number / on-with-number) for the widget
  + product button + POS button. Worker-side enforcement of the flag covered behaviorally by
  the integration suite (per ADR-0008).
- All strings resolve from `en.ts`; no raw `fetch`; no hardcoded hex except the documented
  `#25D366`. `pnpm verify` green.

---

## 8. Non-goals

- **No** WhatsApp Business API / Cloud API integration — deferred to **V2**.
- **No** inbound messaging, webhooks, or conversation handling — `wa.me` deep-link only.
- No change to the checkout `'whatsapp'` payment method or `CheckoutMethodSelector` info text
  beyond what the flag naturally hides.
- No new config endpoint, no D1 migration, no new dependency.

---

## 9. Docs to update

- [`CONTEXT.md`](../../../CONTEXT.md) — **WhatsApp Widget** term already present (verified
  `:96`); confirm it still matches the shipped behavior, adjust wording only if drifted.
- [`docs/features/whatsapp.md`](../../../docs/features/whatsapp.md) — document the
  `whatsappEnabled` toggle and the floating widget (gating rules, generic greeting, brand-green
  exception, mobile-overlap note).
- `README.md` — update the WhatsApp feature line to note it is optional + admin-toggleable +
  has a floating widget.
- Final step: `git mv docs/plans/proposed/phase-19-whatsapp.md docs/plans/done/` and commit
  (per Plan Lifecycle) once 100% done + audited.

---

## 10. Self-audit checklist

- [ ] Floating widget renders on **every** storefront page (mounted in `(store)/layout.tsx`).
- [ ] All **three** surfaces (widget, per-product button, POS button) gated by
      `isFeatureEnabled(config,'whatsappEnabled')` **and** number presence.
- [ ] Flag round-trips through admin settings → PUT `/api/admin/config/store` → reload.
- [ ] Generic greeting builder is DRY (shares `wa.me` assembly with the order builder).
- [ ] All new strings in `en.ts` — nothing hardcoded in JSX.
- [ ] No raw `fetch()` — saves go through `lib/api.ts`.
- [ ] Only `#25D366` hardcoded (documented WhatsApp exception); everything else CSS vars.
- [ ] Widget a11y: aria-label, keyboard, focus ring, no overlap with `AppTabBar` on mobile.
- [ ] Regression tests added for the gating matrix (off / on-no-number / on-with-number).
- [ ] `pnpm verify` green.
- [ ] Phase 17 deps consumed, not re-defined.
- [ ] Plan re-read end-to-end before marking done; `git mv` to `done/`.
