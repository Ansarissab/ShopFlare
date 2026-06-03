# Plan 08 — Dynamic Theme & Design Settings (Admin-editable, zero-rebuild)

> **For the implementer (Sonnet):** Execute this end-to-end. Follow the project's
> DRY rules (CLAUDE.md). Reuse existing patterns — do NOT invent new infra.
> Keep infra cost **$0** (see "Cost guardrails"). Commit in the small focused
> commits listed at the end. Do **not** `git push` or open a PR — the user does that.

---

## 1. Goal

Let every store owner customize the storefront's look from the Admin Dashboard,
with changes reflected **in real time, with no rebuild and no redeploy**. This is
an open-source white-label project — each merchant brands their own store.

Make these dynamic (stored in D1, edited in Admin → Settings → **Appearance**):

| Token            | Examples                                  |
|------------------|-------------------------------------------|
| Primary color    | brand button / link color (+ foreground)  |
| Accent color     | highlights, focus ring (+ foreground)     |
| Border radius    | `none` / `sm` / `md` / `lg` / `full`      |
| Font family      | curated, pre-bundled list (see §6)        |
| Logo             | header logo (R2 upload)                    |
| Favicon          | browser tab icon (R2 upload, optional)     |
| Color mode       | `light` / `dark` / `system` default        |

**Non-goal (v2):** arbitrary Google fonts, per-page themes, CSS editor, theme
marketplace. See §11.

---

## 2. Why this is ~75% wired already (current state)

Read these before touching anything:

- **CSS vars already declared with runtime hooks** — [globals.css:55-59](../../../src/app/globals.css#L55-L59):
  ```css
  --primary:    var(--store-primary,    #18181b);
  --primary-fg: var(--store-primary-fg, #fafafa);
  --accent:     var(--store-accent,     #6366f1);
  --accent-fg:  var(--store-accent-fg,  #ffffff);
  ```
  Radius token `--radius` exists ([globals.css:53](../../../src/app/globals.css#L53)),
  Tailwind maps it ([globals.css:34-37](../../../src/app/globals.css#L34-L37)).
  Dark mode lives under `[data-theme="dark"]` ([globals.css:77-85](../../../src/app/globals.css#L77-L85)).
  **Nothing populates these `--store-*` vars yet — that's the core of this plan.**

- **Config table is key-value** — [worker/db/schema.ts:138-144](../../../worker/db/schema.ts#L138-L144)
  `storeConfig (key PK, value, updatedAt)`. Adding new settings = adding new keys.
  **No migration needed for new string keys.**

- **Config schema is composable** — [src/lib/schemas/config.ts](../../../src/lib/schemas/config.ts).
  Add appearance fields here; `updateConfigSchema = storeConfigSchema.partial()`
  ([src/lib/schemas/admin.ts](../../../src/lib/schemas/admin.ts)) already accepts subsets.

- **Public GET** assembles config from D1 with ETag — [worker/routes/config.ts:49-62](../../../worker/routes/config.ts#L49-L62).
  **Admin PUT** upserts any key + `bumpDataVersion()` — [worker/routes/admin/config.ts:16-40](../../../worker/routes/admin/config.ts#L16-L40).

- **Client hook** fetches `/api/config/store`, refetches on tab focus + on
  `BroadcastChannel(DATA_UPDATED_CHANNEL)` — [src/hooks/useStoreConfig.ts](../../../src/hooks/useStoreConfig.ts).
  Admin save already broadcasts ([settings/page.tsx:71-73](../../../src/app/(admin)/admin/settings/page.tsx#L71-L73)).
  **This is the real-time channel — reuse it, don't add polling.**

- **R2 upload pattern exists** — [worker/routes/admin/products.ts:369-426](../../../worker/routes/admin/products.ts#L369-L426)
  (multipart → `c.env.R2.put` → served via the Worker's own `/cdn/*` route).
  Client compresses with `browser-image-compression` in
  [src/components/admin/products/ImageUpload.tsx](../../../src/components/admin/products/ImageUpload.tsx). Reuse both for logo/favicon.

**What's missing:** appearance fields in schema/types/i18n/constants, a
CSS-var injector (with no-flash boot), the Admin Appearance UI, and a logo
upload route. Everything else is reuse.

---

## 3. Architecture decisions

### 3a. How theme reaches the DOM — and avoiding FOUC

The storefront reads config client-side via `useStoreConfig`. If we only inject
CSS vars *after* fetch, the first paint flashes default colors. Fix with a
**two-stage** approach that stays $0 (no per-request SSR, storefront stays
CDN-cacheable):

1. **Boot (synchronous, pre-paint):** a tiny **inline blocking script** in
   `<head>` reads a cached theme snapshot from `localStorage` and sets the
   `--store-*` vars + `data-theme` on `<html>` *before* React hydrates. No flash
   on any repeat visit. (First-ever visit: brief default until step 2 — acceptable.)
2. **Live (on/after fetch):** a `ThemeProvider` client component takes the
   `config` from `useStoreConfig`, applies the same vars, and **writes the
   snapshot back to `localStorage`** for next boot. Because `useStoreConfig`
   already refetches on `BroadcastChannel`, an admin save updates open storefront
   tabs within one fetch — **real-time, no rebuild**.

> Do **not** convert the root layout to a per-request server fetch. That would add
> a Worker round-trip to every page load and reduce CDN cacheability. The
> localStorage-boot approach gives no-flash repeat visits at zero added cost.

### 3b. Auto-contrast foregrounds (fewer inputs, fewer mistakes)

Merchants pick **primary** and **accent**; foreground (text-on-color) is
auto-computed via a luminance contrast helper (`#000`/`#fff`), with an optional
manual override. Prevents unreadable buttons. Helper goes in `lib/utils`.

### 3c. Fonts stay $0 and zero-rebuild via a curated bundled set

Arbitrary Google fonts can't be added without a rebuild. Instead, **pre-load a
small curated set** with `next/font` in the root layout (build-time, free), each
exposing a CSS variable. The merchant's choice maps `--store-font` to one of
those variables. Switching among the curated set is instant and needs no rebuild.

---

## 4. Data model (new `storeConfig` keys)

All stored as strings in the existing key-value table. New keys:

| Key                  | Type / format                  | Default          |
|----------------------|--------------------------------|------------------|
| `primaryColor`       | hex `#rrggbb`                  | `#18181b`        |
| `primaryColorFg`     | hex (optional override)        | auto-contrast    |
| `accentColor`        | hex                            | `#6366f1`        |
| `accentColorFg`      | hex (optional override)        | auto-contrast    |
| `radius`             | preset key (`none`…`full`)     | `md`             |
| `fontFamily`         | preset key (see §6)            | `sans`           |
| `colorMode`          | `light` \| `dark` \| `system`  | `light`          |
| `logoUrl`            | string URL                     | unset            |
| `logoR2Key`          | string (R2 key, for deletion)  | unset            |
| `faviconUrl`         | string URL                     | unset            |

No DB migration required (key-value). Optional convenience: seed defaults via
the existing seed script if present — otherwise the GET assembler supplies
defaults (§7, step 4).

---

## 5. Validation schema changes

**File:** [src/lib/schemas/base.ts](../../../src/lib/schemas/base.ts) — add a reusable hex validator
(mirror the existing variant color regex in `admin.ts`):

```ts
export const hexColorField = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color')
```

**File:** [src/lib/schemas/config.ts](../../../src/lib/schemas/config.ts) — extend `storeConfigSchema` with an
appearance slice. Keep it composable so the Admin form can `.pick()` it:

```ts
import { hexColorField } from './base'
import { RADIUS_PRESETS, FONT_PRESETS, COLOR_MODES } from '@/lib/constants'

// Appearance slice — kept as its own object then merged, so the Admin form and
// the ThemeProvider can import `appearanceSchema` directly (DRY).
export const appearanceSchema = z.object({
  primaryColor:   hexColorField.optional(),
  primaryColorFg: hexColorField.optional(),
  accentColor:    hexColorField.optional(),
  accentColorFg:  hexColorField.optional(),
  radius:    z.enum(Object.keys(RADIUS_PRESETS) as [string, ...string[]]).optional(),
  fontFamily:z.enum(Object.keys(FONT_PRESETS)  as [string, ...string[]]).optional(),
  colorMode: z.enum(COLOR_MODES).optional(),
  logoUrl:    z.string().url().optional(),
  logoR2Key:  z.string().optional(),
  faviconUrl: z.string().url().optional(),
})

export const storeConfigSchema = z.object({
  // …existing fields unchanged…
}).merge(appearanceSchema)
```

`updateConfigSchema` (in `admin.ts`) already does `.partial()`, so it inherits
the new fields automatically — verify, don't duplicate.

---

## 6. Constants

**File:** [src/lib/constants/index.ts](../../../src/lib/constants/index.ts) — add (as `const`):

```ts
export const RADIUS_PRESETS = {
  none: '0rem',
  sm:   '0.25rem',
  md:   '0.5rem',
  lg:   '0.75rem',
  full: '1.5rem',
} as const

// key → the CSS var emitted by next/font in the root layout (see §7 step 2)
export const FONT_PRESETS = {
  sans:  'var(--font-geist-sans)',
  serif: 'var(--font-merriweather)',
  mono:  'var(--font-geist-mono)',
  rounded: 'var(--font-nunito)',
} as const

export const COLOR_MODES = ['light', 'dark', 'system'] as const

// Optional one-click starting points for the Appearance UI
export const THEME_PRESETS = [
  { name: 'Midnight', primaryColor: '#18181b', accentColor: '#6366f1' },
  { name: 'Emerald',  primaryColor: '#065f46', accentColor: '#10b981' },
  { name: 'Sunset',   primaryColor: '#9a3412', accentColor: '#f97316' },
  { name: 'Ocean',    primaryColor: '#0c4a6e', accentColor: '#0ea5e9' },
] as const
```

> Pick fonts that `next/font/google` supports; load them in §7 step 2. Keep the
> set small (4) — every extra font is bundle weight, not cost.

---

## 7. Implementation steps (ordered)

### Step 1 — Types
**File:** [src/lib/types/store.ts](../../../src/lib/types/store.ts).
`StoreConfig` already derives from the schema, so the new fields flow through
automatically — confirm `StoreConfigData` picks them up. Add one helper type:

```ts
export type ThemeSnapshot = Pick<StoreConfig,
  'primaryColor' | 'primaryColorFg' | 'accentColor' | 'accentColorFg' |
  'radius' | 'fontFamily' | 'colorMode'>
```

### Step 2 — Load curated fonts + boot script in the root layout
**File:** [src/app/layout.tsx](../../../src/app/layout.tsx).
- Import the curated fonts via `next/font/google` (Merriweather, Nunito, etc.),
  each with its `variable` matching `FONT_PRESETS`. Add their `.variable`
  classes to `<html>` alongside the existing Geist vars.
- Add `suppressHydrationWarning` to `<html>` (we mutate it pre-hydration).
- Add the **inline boot script** in `<head>` (a `<script dangerouslySetInnerHTML>`).
  Keep it tiny and dependency-free. It must:
  1. read `localStorage.getItem('shopflare-theme')` (a JSON `ThemeSnapshot`),
  2. `document.documentElement.style.setProperty('--store-primary', …)` etc.,
  3. set `--radius`, `--store-font`,
  4. resolve `colorMode` (`system` → `matchMedia('(prefers-color-scheme: dark)')`)
     and set `data-theme="dark"` when dark.
  Wrap in `try/catch` so a parse error never blocks paint.

> The storage **key** (`'shopflare-theme'`) and the var names must match the
> `ThemeProvider` exactly. Put them in one shared module (`src/lib/theme.ts`,
> step 3) and reference from both to stay DRY.

### Step 3 — Shared theme module + `ThemeProvider`
**New file:** `src/lib/theme.ts` — single source of truth for applying a theme:

```ts
import { RADIUS_PRESETS, FONT_PRESETS } from '@/lib/constants'
import { contrastColor } from '@/lib/utils' // step 6
import type { ThemeSnapshot } from '@/lib/types/store'

export const THEME_STORAGE_KEY = 'shopflare-theme'

// Applies a snapshot to <html>. Used by ThemeProvider (live) AND mirrored by the
// inline boot script (which is hand-inlined JS but must match this logic).
export function applyTheme(t: Partial<ThemeSnapshot>) {
  const root = document.documentElement
  const set = (k: string, v?: string) => v && root.style.setProperty(k, v)
  set('--store-primary',    t.primaryColor)
  set('--store-primary-fg', t.primaryColorFg ?? (t.primaryColor && contrastColor(t.primaryColor)))
  set('--store-accent',     t.accentColor)
  set('--store-accent-fg',  t.accentColorFg ?? (t.accentColor && contrastColor(t.accentColor)))
  if (t.radius)     set('--radius', RADIUS_PRESETS[t.radius as keyof typeof RADIUS_PRESETS])
  if (t.fontFamily) set('--store-font', FONT_PRESETS[t.fontFamily as keyof typeof FONT_PRESETS])
  if (t.colorMode) {
    const dark = t.colorMode === 'dark' ||
      (t.colorMode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    root.setAttribute('data-theme', dark ? 'dark' : 'light')
  }
}
```

**New file:** `src/components/store/ThemeProvider.tsx` (`'use client'`):
- calls `useStoreConfig()`,
- on `config` change: `applyTheme(config)` **and** writes the `ThemeSnapshot`
  to `localStorage[THEME_STORAGE_KEY]`,
- renders `null` (side-effect only) or `{children}`.

Mount it in the **store layout** [src/app/(store)/layout.tsx](../../../src/app/(store)/layout.tsx) so it covers all storefront
pages (header/footer already there). Admin can opt out or include it too.

### Step 4 — globals.css: wire `--store-font`
**File:** [src/app/globals.css](../../../src/app/globals.css). Make `body` font-family consume the new var with a
fallback to Geist:
```css
body { font-family: var(--store-font, var(--font-geist-sans)); }
```
The color/radius hooks already exist (§2) — no other CSS change needed.

### Step 5 — Worker GET: supply appearance defaults
**File:** [worker/routes/config.ts](../../../worker/routes/config.ts). In the `assembled` object (lines 49-62), add the
new keys with the §4 defaults, e.g.:
```ts
primaryColor: kv['primaryColor'] || '#18181b',
radius:       (kv['radius'] as StoreConfigData['radius']) || 'md',
colorMode:    (kv['colorMode'] as StoreConfigData['colorMode']) || 'light',
logoUrl:      kv['logoUrl'] || undefined,
// …etc
```
ETag logic is unchanged (fingerprint already covers all rows). The Admin PUT
needs **no change** — it upserts any validated key (§2).

### Step 6 — Contrast helper
**File:** [src/lib/utils.ts](../../../src/lib/utils.ts) (or `lib/utils/` index). Add `contrastColor(hex)`:
parse `#rrggbb`, compute relative luminance, return `'#000000'` or `'#ffffff'`.
Pure function, no deps. Add a unit test next to the other `*.test.ts` if the
project tests utils.

### Step 7 — Logo + favicon upload route (R2)
**File:** [worker/routes/admin/config.ts](../../../worker/routes/admin/config.ts). Add `POST /logo` (and `/favicon`),
modeled on [products.ts:369-426](../../../worker/routes/admin/products.ts#L369-L426):
- accept multipart `file`, validate MIME + size (reuse `ALLOWED_IMAGE_TYPES`,
  `MAX_IMAGE_BYTES` — add SVG to the allowed set for logos if desired),
- **content-addressed key** = `branding/logo-<nanoid>.<ext>` (NOT a stable key —
  see the caching note below), then delete the previous `logoR2Key` so no orphan,
- `c.env.R2.put(...)`, build URL via the existing `/cdn/<key>` origin pattern,
- upsert `logoUrl` + `logoR2Key` into `storeConfig`, `bumpDataVersion(db)`,
- return `{ logoUrl }`.

> **Caching contract — must use content-addressed keys.** The `/cdn/*` route
> serves `Cache-Control: public, max-age=31536000, immutable`
> ([worker/index.ts:43-54](../../../worker/index.ts#L43-L54)). A *stable* key
> (`branding/logo.png`) would make a re-uploaded logo serve **stale for a year**.
> Every branding asset MUST get a fresh nanoid key on upload (like product
> images), and the old key is deleted. New key → new immutable URL → instant
> update + permanent edge cache. Do not weaken the `/cdn/*` cache header.
>
> Reuse the Worker's existing `/cdn/*` route — do **not** make the R2 bucket
> public. R2 free tier (10 GB) keeps this $0.

### Step 8 — i18n strings
**File:** [src/lib/i18n/en.ts](../../../src/lib/i18n/en.ts), inside the `admin:` object (line 134+). Add an
appearance block — **all UI text must come from here**, never hardcoded:
```ts
appearance: 'Appearance',
appearanceHint: 'Customize your store look. Changes apply live — no redeploy.',
primaryColor: 'Primary color', accentColor: 'Accent color',
foregroundOverride: 'Text color (auto if blank)',
borderRadius: 'Corner radius', fontFamily: 'Font', colorMode: 'Color mode',
logo: 'Logo', favicon: 'Favicon', uploadLogo: 'Upload logo', removeLogo: 'Remove',
themePresets: 'Quick presets', preview: 'Live preview',
appearanceSaved: 'Appearance updated',
```

### Step 9 — Admin Appearance UI
**File:** [src/app/(admin)/admin/settings/page.tsx](../../../src/app/(admin)/admin/settings/page.tsx). Add an **Appearance** section
following the exact pattern of the existing bordered sections (lines 98-166):
- color inputs: native `<input type="color">` wrapped in the existing `FormField`
  + a hex `<Input>` mirror (cheap, accessible, $0 — no new lib),
- `radius` / `fontFamily` / `colorMode`: existing shadcn `Select`,
- `THEME_PRESETS`: row of buttons that set the color state,
- **Logo upload:** reuse / generalize the `ImageUpload` component (or a thin
  wrapper) → calls `apiUpload('/api/admin/config/logo', form)`,
- **Live preview** card: a small box of mock button/link/card that reads the
  current CSS vars — apply the in-progress values to a scoped element via inline
  style so the merchant sees it before saving,
- extend the existing `handleSave` (line 51) to include the appearance fields in
  the same `apiPut('/api/admin/config/store', …)` call — it already broadcasts
  `DATA_UPDATED_CHANNEL` (line 71-73), which triggers the storefront `ThemeProvider`
  live. **No new save path.**

Reuse `useStoreConfig` for initial values (the page already does, line 19) and
seed the new local state in the existing `useEffect` (lines 35-49).

---

## 8. DRY compliance checklist (CLAUDE.md)

- [ ] Colors only via CSS vars in globals.css — no hardcoded hex in components.
- [ ] All UI text in `en.ts` — none inline in JSX.
- [ ] New types inferred from the Zod schema; only `ThemeSnapshot` added by hand.
- [ ] Schema extended via `.merge()` of `appearanceSchema`; form `.pick()`s it —
      no inline schemas in routes/forms.
- [ ] Constants (`RADIUS_PRESETS`, `FONT_PRESETS`, `COLOR_MODES`, `THEME_PRESETS`)
      in `lib/constants` — never inlined.
- [ ] All network via `lib/api.ts` (`apiPut`, `apiUpload`) — no raw `fetch`.
- [ ] Logo upload reuses the products R2 pattern + `/cdn/*` route + `ImageUpload`.
- [ ] `applyTheme` is the single source of truth; the boot script mirrors it and
      both reference the shared storage key + var names from `src/lib/theme.ts`.

---

## 9. Cost guardrails ($0)

- **No new services.** Colors/radius/font/mode are strings in existing D1
  `storeConfig` — within free tier.
- **Logo/favicon → R2** (existing bucket, served via the existing `/cdn/*`
  Worker route). R2 free tier = 10 GB storage + free egress via Worker. A few
  brand images is negligible.
- **Fonts** are bundled at build via `next/font` (free, self-hosted by Next) —
  no runtime font CDN calls.
- **No new Worker endpoints beyond logo/favicon upload**; reuse the existing
  config GET/PUT. No KV required (ETag on GET already caches; add KV only if a
  future perf need appears — out of scope, would still be free tier).
- **No per-request SSR** added — storefront stays CDN-cacheable on CF Pages.

---

## 10. Performance, caching & SEO — target: PageSpeed all-green

Goal: https://pagespeed.web.dev/ shows **green (90+) on all four** categories
(Performance, Accessibility, Best Practices, SEO), mobile + desktop, with good
Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms). The dynamic-theme work
must *help* these scores, never regress them. All of the below stays $0.

### 10a. Caching (edge + browser)

- **Branding/product images (`/cdn/*`)** — already `Cache-Control: public,
  max-age=31536000, immutable` ([worker/index.ts:43-54](../../../worker/index.ts#L43-L54)).
  Keep it. Correctness depends on **content-addressed keys** (§7) so a new logo
  = new URL. Cloudflare caches these at edge automatically → repeat loads are
  free + instant.
- **Next static assets** (JS/CSS/font files) — hashed filenames, served by CF
  Pages with immutable caching by default. Don't add headers that weaken this.
- **Config GET (`/api/config/store`)** — keep `no-cache` + ETag (correctness for
  live theme updates). It's a tiny JSON; add `stale-while-revalidate=60` to the
  `Cache-Control` so the edge can serve instantly while revalidating, without
  losing freshness. Theme paint never blocks on it (boot script handles paint).
- **HTML** — storefront stays statically cacheable on CF Pages (no per-request
  SSR added by this plan, see §3a). Let CF's default edge cache apply.

### 10b. Prefetch / preconnect / preload

- **Preconnect to the Worker/CDN origin** — add `<link rel="preconnect">` +
  `<link rel="dns-prefetch">` to the Worker origin in the root layout `<head>`
  (logo + product images + API live there; cross-origin handshake is otherwise
  on the LCP path). Also `preconnect` to Stripe + Turnstile origins.
- **Preload the LCP logo** — the header logo is a likely LCP element. Render it
  with `next/image` + `priority` (emits a preload + skips lazy-load). Because
  `logoUrl` is dynamic, the `ThemeProvider`/header reads it from config; the
  boot snapshot can also carry `logoUrl` so the header can `priority`-load it on
  first paint without waiting for the JSON.
- **Route prefetch** — keep Next `<Link>` default prefetch on for in-viewport
  storefront nav (product cards → PDP). No code change, just don't disable it.

### 10c. Images (no CLS, modern formats)

- Serve **all** storefront images via `next/image` with explicit `width`/`height`
  (or `fill` + sized container) → reserved space, **CLS ≈ 0**.
- Enable AVIF/WebP in `next.config` `images.formats`; set
  `images.minimumCacheTTL` high. For CF Pages, ensure the image loader is
  configured (custom loader pointing at `/cdn/*`, or `unoptimized` with our own
  pre-compression — we already compress on upload via `browser-image-compression`).
- **Logo upload UI** must capture/display intrinsic dimensions so the rendered
  `<Image>` always has width/height → no layout shift when the logo swaps.

### 10d. Fonts (no CLS, minimal bytes)

- `next/font` self-hosts (no third-party font CDN call — good for Best Practices
  + LCP). For the curated set (§6): set `display: 'swap'` and
  `preload: true` **only for the default `sans`**; the other three
  `preload: false` (loaded only when a merchant selects them) to keep bundle/
  preload weight down.
- Rely on `next/font`'s automatic `size-adjust`/fallback metrics to minimize CLS
  when a non-default font swaps in.

### 10e. CLS / INP from the theme system specifically

- The **no-flash boot script (§3a, §7-step2)** is the main CLS defense: colors,
  radius, font var, and `data-theme` are set **before first paint**, so there's
  no recolor/reflow after hydration.
- `applyTheme` only sets a handful of CSS custom properties (cheap, no layout
  thrash) — keep it O(1), no per-element style writes → protects INP.
- Boot script must be **tiny + inline** (no external request) and wrapped in
  try/catch so it can never block the main thread or break paint.

### 10f. SEO + metadata (dynamic, from store config)

- **Dynamic metadata via `generateMetadata`** (Next App Router) — title +
  description from `storeName`/`tagline`, `icons` from `faviconUrl`, OpenGraph +
  Twitter cards using `logoUrl`, and a `canonical` URL. This fetch is **for
  metadata only** (cacheable with `next: { revalidate }`), separate from the
  theme paint path — it does not reintroduce blocking SSR for the page body.
- **Favicon** — wire `faviconUrl` into the metadata `icons` so the browser tab
  reflects the merchant brand (falls back to a default when unset).
- **`robots.txt` + `sitemap.xml`** — add a dynamic `sitemap.ts` (App Router) that
  lists storefront + product routes, and a `robots.ts`. Both are static/cached,
  $0, and directly lift the SEO score.
- **Structured data (JSON-LD)** — emit `Organization`/`Store` on the layout and
  `Product`/`Offer` on PDPs (name, price, currency, availability). Improves SEO
  + rich results; pure markup, no cost.
- **`<html lang>`** already set; ensure every image (incl. logo) has meaningful
  `alt` text (logo `alt` = `storeName`) for Accessibility + SEO.

### 10g. Accessibility & Best Practices (the other two green bars)

- **Contrast** — the auto `contrastColor` (§3b, §6-step6) guarantees readable
  text-on-brand. The Appearance UI should **warn** if a merchant's manual
  foreground override fails WCAG AA contrast against its background.
- All color/file inputs use the existing `FormField` (label association) → no
  unlabeled-control a11y failures.
- HTTPS is automatic on CF Pages/Workers (Best Practices). Keep the console free
  of errors; ensure images have correct aspect ratios (covered by 10c).

> **Net effect:** content-addressed immutable CDN caching + preconnect/preload +
> `next/image`/`next/font` + the no-flash boot script + dynamic metadata/sitemap/
> JSON-LD → fast LCP, ~0 CLS, low INP, and full SEO/a11y/best-practice coverage.
> All within the existing free-tier stack.

---

## 11. Testing & acceptance criteria

Manual (dev server on port 5000):
1. Admin → Settings → Appearance: change primary to `#dc2626`, save.
2. Open storefront in another tab **already open** → header buttons turn red
   within one refetch (BroadcastChannel), **no manual reload**.
3. Hard-reload the storefront → **no color flash** (boot script applied cached
   snapshot pre-paint).
4. Set radius `full` → buttons/cards round; set font `serif` → body font changes.
5. Set color mode `dark` → `[data-theme="dark"]` applied; `system` follows OS.
6. Upload a logo → appears in `StorefrontHeader`; persists across reloads; old
   R2 object replaced (no orphan).
7. Leave a foreground blank → auto-contrast keeps text readable on the chosen bg.
8. Invalid hex in the API is rejected by `appearanceSchema` (400).

Automated:
- Unit test `contrastColor()` (black bg → white, white bg → black, mid-tones).
- If schema tests exist, assert `storeConfigSchema` accepts a full appearance
  object and rejects a bad hex / unknown radius key.

Build: `pnpm build` (or project's build cmd) passes; no type errors from the
schema-derived types.

PageSpeed / Lighthouse (run against a deployed preview, mobile + desktop):
9. https://pagespeed.web.dev/ — **all four categories green (90+)**: Performance,
   Accessibility, Best Practices, SEO.
10. Core Web Vitals: **LCP < 2.5s, CLS < 0.1, INP < 200ms**. Confirm CLS stays
    ~0 across a theme change + logo swap (no shift).
11. Verify the logo serves with `Cache-Control: …immutable` and the metadata,
    `sitemap.xml`, `robots.txt`, and Product JSON-LD are present.

---

## 12. Out of scope (v2 — note, don't build)

- Arbitrary Google/custom font upload (needs rebuild or a font CDN).
- Per-page / per-section theming, full CSS editor, theme import/export.
- Background images / gradient builders, secondary palette beyond primary/accent.
- Theme marketplace / shareable theme links.

---

## 13. Suggested commits (small, focused — conventional style)

1. `feat(schema): add appearance fields to storeConfigSchema + hexColorField`
2. `feat(constants): add RADIUS/FONT/COLOR_MODE/THEME presets`
3. `feat(theme): add applyTheme + contrastColor + ThemeSnapshot type`
4. `feat(storefront): inject store theme via ThemeProvider + no-flash boot script`
5. `feat(worker): default appearance fields in config GET + content-addressed logo/favicon R2 upload`
6. `feat(admin): Appearance section with color pickers, presets, logo upload, live preview`
7. `feat(i18n): appearance strings`
8. `perf(storefront): preconnect/preload CDN origin + priority logo + next/image+font tuning`
9. `feat(seo): dynamic metadata, favicon, sitemap.ts, robots.ts, Product/Store JSON-LD`
10. `test: contrastColor + appearance schema`

> Do not push or open a PR. Stop after the working tree is committed and report.
