# ShopFlare Design System

## Thesis

A small shop that looks like a real brand. No startup templates, no SaaS gradients.
Editorial restraint: high contrast, generous white space, one accent color that earns
its keep. The merchant's product is the visual hero — the UI stays out of the way.

---

## Fonts

| Role        | Family             | Variable             | Weights / Styles       | Notes                                      |
|-------------|--------------------|----------------------|------------------------|--------------------------------------------|
| Display     | Instrument Serif   | `--font-display`     | 400, 400 italic        | h1–h4 only. Self-hosted via `next/font`.   |
| Body / UI   | Geist Sans         | `--font-geist-sans`  | variable               | Body, labels, buttons, inputs.             |
| Prices / #  | Geist Mono         | `--font-geist-mono`  | variable               | Prices, SKUs, codes, numeric data.         |
| Merchant alt: Merriweather | `--font-merriweather` | 400, 700 | Optional merchant body font (preload:false). |
| Merchant alt: Nunito       | `--font-nunito`       | variable | Optional rounded font (preload:false).      |

**Loading:** `next/font/google` self-hosts all fonts at build time. Zero external
font requests at runtime. Instrument Serif loads `normal` + `italic` in weight 400 only.

**Merchant override:** Body font is overridable via `--store-font` CSS variable (set
by the boot script from `localStorage` before React hydrates). Display font (`--font-display`)
is not merchant-overridable in v1 — it is the brand identity of the design system.

---

## Color Tokens

All tokens are CSS custom properties in `src/app/globals.css`. Merchant brand colors
(`--store-primary`, `--store-accent`) are injected at runtime from D1 store config.
Components must use only CSS variables — never hardcode hex.

### Light mode (`:root`)

| Token                | Default       | Role                                      |
|----------------------|---------------|-------------------------------------------|
| `--bg`               | `#FAFAF7`     | Page background — warm off-white          |
| `--card`             | `#F4F4EF`     | Surface / card background                 |
| `--fg`               | `#1A1A18`     | Body text / ink                           |
| `--muted`            | `#EBEBE4`     | Subtle fills, dividers, skeleton loaders  |
| `--muted-fg`         | `#76766E`     | Placeholder text, secondary labels        |
| `--border`           | `#E2E2DA`     | Input borders, card outlines              |
| `--primary`          | `var(--store-primary, #1A1A18)` | CTA buttons, key actions    |
| `--primary-fg`       | `var(--store-primary-fg, #FAFAF7)` | Text on primary surfaces |
| `--accent`           | `var(--store-accent, #4A7C6F)` | Oxidized copper — links, badges, focus rings |
| `--accent-fg`        | `var(--store-accent-fg, #FAFAF7)` | Text on accent surfaces  |
| `--destructive`      | `#ef4444`     | Errors, delete actions                    |
| `--success`          | `#22c55e`     | Confirmations, stock indicators           |
| `--warning`          | `#f59e0b`     | Low stock, pending states                 |

### Dark mode (`[data-theme="dark"]`)

| Token          | Default     | Change from light          |
|----------------|-------------|----------------------------|
| `--bg`         | `#141412`   | Deep warm black            |
| `--card`       | `#1E1E1B`   | Slightly lifted surface    |
| `--fg`         | `#F0F0EB`   | Warm white                 |
| `--muted`      | `#2A2A26`   | Dark fill                  |
| `--muted-fg`   | `#8A8A82`   | Dimmed label text          |
| `--border`     | `#333330`   | Subtle warm dark border    |
| `--accent`     | `var(--store-accent, #6AAE9E)` | Lighter copper for contrast |

Primary/primary-fg carry over from `:root` unless the merchant overrides them.

### Merchant override pattern

```css
--primary: var(--store-primary, #1A1A18);
--accent:  var(--store-accent,  #4A7C6F);
```

The fallback is the design-system default. Merchants set `--store-primary` / `--store-accent`
via the Admin Dashboard; the boot script applies them from `localStorage` before paint.

---

## Type Scale

| Element | Size       | Family         | Weight | Tracking  |
|---------|------------|----------------|--------|-----------|
| h1      | `text-4xl` | Instrument Serif | 400  | `tracking-tight` |
| h2      | `text-3xl` | Instrument Serif | 400  | `tracking-tight` |
| h3      | `text-2xl` | Instrument Serif | 400  | —         |
| h4      | `text-xl`  | Instrument Serif | 400  | —         |
| body    | `text-base`| Geist Sans     | 400    | —         |
| small   | `text-sm`  | Geist Sans     | 400    | —         |
| price   | `text-lg`  | Geist Mono     | 500    | —         |
| label   | `text-xs`  | Geist Sans     | 500    | `tracking-wide` uppercase |

The serif at weight 400 reads with authority because of its high stroke contrast —
adding bold would compete with the letterforms. Never apply `font-bold` to h1–h4.

---

## Radius

Controlled via `--radius` (default `0.5rem`). Merchant-selectable presets:

| Key    | Value      |
|--------|------------|
| none   | `0rem`     |
| sm     | `0.25rem`  |
| md     | `0.5rem`   |
| lg     | `0.75rem`  |
| full   | `1.5rem`   |

Tailwind tokens `--radius-sm/md/lg/xl` derive from `--radius` via `calc()`.

---

## Motion Principles

### Product imagery
On hover, product images desaturate (`filter: grayscale(100%)`) with a `200ms ease`
transition. This creates editorial restraint and draws the eye to the product name
and price rather than competing colors. Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: no-preference) {
  .product-image { transition: filter 200ms ease; }
  .product-image:hover { filter: grayscale(100%); }
}
```

### Grid entrance (Wave 2)
Product grid items use `@starting-style` for staggered entrance — each card fades
and lifts in from `translateY(8px)` with a `150ms` delay increment per visible item.
Native CSS, no JS animation library needed. Gated on `prefers-reduced-motion`.

### Add-to-cart confirmation (Wave 2)
Cart icon receives a brief scale pulse (`scale(1.2) → scale(1)` over `300ms`) and
the button label swaps to a checkmark for `1.5s` before reverting. No toast overlay
needed — the feedback is in-context.

### Page transitions
Already implemented via CSS `@view-transition` (see `globals.css`). Slide-in/out
at 200ms. Disabled under `prefers-reduced-motion`.

### Principle
All durations stay under `300ms` for interactive feedback, under `500ms` for
entrance animations. Never animate layout properties (width, height) — only
`transform` and `opacity`. Always respect `prefers-reduced-motion: reduce`.

---

## Anti-Slop Rules

These are enforced by convention, not linting. Violating them triggers a design review.

1. **No indigo/purple gradients.** The old `#6366f1` accent is replaced. Indigo is
   "SaaS dashboard" not "merchant storefront." The new `#4A7C6F` oxidized copper
   reads as craft, not tech.

2. **No 3-column icon grids.** "Free shipping / Easy returns / Secure payment" in
   three columns with emoji icons is a trust-signal cliché. If these facts matter,
   put them in prose or a single inline strip.

3. **No centered-everything layouts.** Text-align center for body copy is a sign
   you don't trust the content. Hero headlines may center on mobile; product
   descriptions never do.

4. **No decorative blobs.** No SVG blobs, no `radial-gradient` background accents,
   no floating orbs. Background interest comes from the product photography.

5. **Cards earn their place.** A card is a contained unit with a clear action. Don't
   card every piece of content. Flat lists with borders are often cleaner.

6. **Prices in mono, always.** Any number representing money uses `font-family:
   var(--font-geist-mono)`. This prevents digit-width jitter in dynamic lists.

7. **One accent.** The `--accent` color appears in at most one visual role per
   screen region (e.g., "Add to Cart" CTA OR a badge OR a link — not all three
   simultaneously). Use `--primary` (near-black) for secondary actions.
