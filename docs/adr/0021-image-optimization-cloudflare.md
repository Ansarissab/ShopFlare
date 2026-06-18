# 0021 — Image optimization & LCP on Cloudflare (free tier)

Status: Accepted (2026-06-17)

## Context

Mobile PageSpeed on the home/catalog page was **79, with LCP 5.6s the only failing metric**
(FCP/TBT/CLS/SI all green; A11y/BP/SEO 100). Two root causes, both about the hero product
image:

1. **Four images were preloaded `fetchpriority=high`** (`PRIORITY_CARD_COUNT = 4` plus the
   featured strip's `index < 4`). On mobile 4G the four ~193 KiB preloads starved each other,
   delaying the *actual* LCP image.
2. **`images.unoptimized = true`** served 800×800 originals into a ~195px grid slot (~10×
   oversized, no `srcset`). It was set because Next's built-in image optimizer runs as a Node
   service that **cannot run on Cloudflare Workers**.

## Decision

1. **One hi-priority image.** Only the first above-the-fold image preloads:
   `PRIORITY_CARD_COUNT = 1`, featured strip `index === 0`. A regression test in
   `ProductGrid.test.tsx` asserts exactly one priority card.
2. **Custom Next image loader** (`image-loader.ts`, wired via `images.loaderFile`; removed
   `unoptimized`). With a custom loader Next builds a real `srcset` from the loader's output
   and never calls its own optimizer endpoint — so it works on Workers with zero server cost.
3. **Generic, rule-based, never host-hardcoded.** The loader applies an ordered list of
   `RESIZE_RULES` (a `test` predicate + a `toWidth` builder). A source that supports URL-based
   resizing is ONE entry; anything unmatched passes through unchanged. Add a resizable source
   by adding a rule — never special-case a host inline elsewhere.

## How real images stay fast (the durable path)

The free Cloudflare plan has **no server-side image resizing**, so the loader cannot resize
arbitrary URLs — and must not try. Instead:

- **Merchant images (R2 `/cdn/...`)** are compressed and sized **at upload** by the
  browser-image-compression AVIF pipeline (shared `ImageUpload`). They reach R2 already
  optimized, so the loader passes them through untouched. Real stores therefore score *better*
  than the demo.
- **Demo seed images (`picsum.photos`)** are external and resizable via their URL path, so the
  one shipped rule rewrites them to the requested display width. This rule is demo-scoped; it
  simply stops matching once real products replace the seed data.
- `data:` / `blob:` always pass through.

## Consequences

- Verified on the real workerd (`opennextjs-cloudflare preview`): the home page emits exactly
  **one** image preload, now carrying a responsive `imageSrcSet` (256w…1920w) + `imageSizes`,
  so a mobile grid slot fetches ~256–640px instead of 800×800.
- Every `<Image fill>` must pass a `sizes` prop (else Next warns under a custom loader and can't
  size correctly). Audited; `StorySection` was the last one missing it and was fixed.
- **Ceiling caveats:** the demo's picsum images are on an external origin (extra DNS/TLS we
  can't remove for the demo), and ~680ms of render-blocking Tailwind CSS remains (secondary —
  do NOT use the Tailwind Play CDN; it ships the whole engine as render-blocking JS and is
  worse; critical-CSS inlining is fragile and disabled deliberately — see `next.config.ts`).
- **If on-the-fly resizing of arbitrary merchant images is ever needed**, that requires
  Cloudflare Images / Image Resizing (paid) or a dedicated resizing worker — add it as a new
  `RESIZE_RULE`, don't reintroduce `unoptimized`.
