# Plan 18 — Image Compression with Confirmation

> **For the implementer:** Execute end-to-end. Follow CLAUDE.md DRY rules.
> UI strings live in [src/lib/i18n/en.ts](../../../src/lib/i18n/en.ts) — never
> hardcode text in JSX. Network I/O via [src/lib/api.ts](../../../src/lib/api.ts)
> only — no raw `fetch()`. Never edit build/output folders
> (`.next/`, `.open-next/`, `coverage/`, `test-results/`). Do **not** `git push`
> or open a PR. Small focused commits per §7.
>
> **Builds on Phase 17 — do NOT re-implement it.** Phase 17 already landed the
> shared shell + util (see §5). Phase 18 finishes the UX, tuning, wiring, server
> backstop messaging, and tests.

---

## 1. Goal

Make image upload **fast and predictable** for non-developer merchants on the
$0 stack. Compress heavily but **visually-lossless** before upload, and when an
original is large enough to surprise the user, **show a before/after confirm
dialog** so they see what's about to happen and can cancel.

Locked decisions (user):
- **Visually-lossless heavy compression** — AVIF/WebP at ~q80 plus a
  max-dimension cap of ~2000px. **NOT** true lossless (true lossless defeats the
  $0 R2/CDN goal).
- **Threshold-gated confirm** — only show the before/after dialog when the
  **original exceeds 3MB** ([`COMPRESS_CONFIRM_THRESHOLD_BYTES`](../../../src/lib/image.ts)).
  Smaller images compress **silently**, exactly as today. The dialog shows
  original-vs-compressed bytes + a preview thumbnail of the compressed result.
- **Hard block** — if the compressed result *still* exceeds the R2 cap
  (`MAX_IMAGE_BYTES` = 5MB), block the upload client-side with a clear message;
  the server keeps its 413 backstop regardless.
- **Fallback** — if client compression underperforms (mobile Safari OOM, huge
  source files), fall back to Cloudflare Image transformations on R2 (free
  5000/mo tier) or worker-side re-encode. Documented in §6, not built in §3.

---

## 2. Current state

Client compression today is **duplicated** and **silent** in two places, both
using the same `browser-image-compression` config and giving **no UI feedback**:

| Caller | File:line | Config |
|--------|-----------|--------|
| Product images | [ImageUpload.tsx:24-34](../../../src/components/admin/products/ImageUpload.tsx#L24-L34) | `{ maxSizeMB: 0.8, maxWidthOrHeight: 1200, useWebWorker: true }` |
| Category hero | [CategoryImageUpload.tsx:23-33](../../../src/components/admin/categories/CategoryImageUpload.tsx#L23-L33) | identical |

Server upload routes (server-side validation already present — MIME 415 + size 413):
- Product: [products.ts:368-428](../../../worker/routes/admin/products.ts#L368-L428) —
  `POST /api/admin/products/images/upload`, FormData `file`+`variantId`+`sortOrder`,
  MIME check, `MAX_IMAGE_BYTES` cap, `R2.put`, returns `/cdn/{key}` URL.
- Category: [categories.ts:181-239](../../../worker/routes/admin/categories.ts#L181-L239) —
  `POST /api/admin/categories/:id/image`, FormData `file`, same checks.

Constants:
- [constants/index.ts:35](../../../src/lib/constants/index.ts#L35) —
  `MAX_IMAGE_BYTES = 5 * 1024 * 1024`.
- [constants/index.ts:36](../../../src/lib/constants/index.ts#L36) —
  `ALLOWED_IMAGE_TYPES = ['image/jpeg','image/png','image/webp','image/avif']`.

Serving:
- [worker/index.ts:37-53](../../../worker/index.ts#L37-L53) — `GET /cdn/:*`,
  R2 stream, `Cache-Control: public, max-age=31536000, immutable`.

**Phase 17 already shipped** (reference, do NOT rebuild):
- [src/lib/image.ts](../../../src/lib/image.ts) — exports
  `COMPRESS_CONFIRM_THRESHOLD_BYTES` (3MB), `CompressResult { file, originalBytes, compressedBytes }`,
  and `compressImage(file, opts)`.
- [src/components/shared/ImageUpload.tsx](../../../src/components/shared/ImageUpload.tsx) —
  shared component shell, props `{ endpoint, extraFields?, onUploaded, max?, currentImages? }`.
  Both product + category callers refactor onto this.

---

## 3. Deliverables

### 3.1 Confirm-dialog UX in the shared `ImageUpload`
Flow inside [src/components/shared/ImageUpload.tsx](../../../src/components/shared/ImageUpload.tsx):
1. User picks a file → read `originalBytes` from `file.size`.
2. Always call `compressImage(file)` → `CompressResult`.
3. **If `originalBytes <= COMPRESS_CONFIRM_THRESHOLD_BYTES`** → upload silently
   (current behavior preserved). No dialog.
4. **If `originalBytes > COMPRESS_CONFIRM_THRESHOLD_BYTES`** → open a confirm
   dialog showing:
   - original size vs compressed size (human-readable, e.g. `9.4 MB → 0.7 MB`),
     plus % saved;
   - a **preview thumbnail** of the compressed result (object URL from
     `result.file`; revoke on close to avoid leaks);
   - **Upload** + **Cancel** buttons. Cancel resets the file input, no request.
5. **Hard block:** if `result.compressedBytes > MAX_IMAGE_BYTES`, disable Upload,
   show the over-cap error message, keep Cancel. (Edge case: compression
   underperformed on a pathological source — see §6 fallback.)
6. On confirm/silent → existing `apiUpload` path with `endpoint` + `extraFields`.

Use the existing shadcn `Dialog` (or `AlertDialog`) primitive already in the repo
— do not add a new dependency. Format bytes with a helper in
[src/lib/utils](../../../src/lib/utils) (add `formatBytes` if not present —
reuse, don't inline).

### 3.2 `compressImage` tuning
In [src/lib/image.ts](../../../src/lib/image.ts), finalize the
`browser-image-compression` options to the locked target:
- `fileType: 'image/avif'` preferred, `'image/webp'` fallback (AVIF encode is not
  universally supported in `browser-image-compression`'s canvas path — detect /
  try-catch and fall back to WebP, then JPEG as last resort);
- quality ~`0.8` (`initialQuality: 0.8`);
- `maxWidthOrHeight: 2000` (was 1200 — raised so large hero/product shots stay
  crisp while still capped);
- `useWebWorker: true`;
- keep `maxSizeMB` as a soft ceiling but let quality+dimension drive the result.
- Output `fileType` must stay within `ALLOWED_IMAGE_TYPES` so the server accepts
  it — webp + avif are already allowed ([constants/index.ts:36](../../../src/lib/constants/index.ts#L36)).

### 3.3 Refactor both callers onto the shared component
- [src/components/admin/products/ImageUpload.tsx](../../../src/components/admin/products/ImageUpload.tsx)
  → render shared `ImageUpload` with
  `endpoint="/api/admin/products/images/upload"`,
  `extraFields={{ variantId, sortOrder: String(images.length) }}`,
  `max={MAX_IMAGES_PER_VARIANT}`, mapping `onUploaded`/delete to existing props.
- [src/components/admin/categories/CategoryImageUpload.tsx](../../../src/components/admin/categories/CategoryImageUpload.tsx)
  → shared `ImageUpload` with
  `endpoint={\`/api/admin/categories/${categoryId}/image\`}`, single-image mode.
- **Delete the duplicated `imageCompression(...)` blocks** from both files. After
  this, `browser-image-compression` is imported in **exactly one place**
  (`src/lib/image.ts`). Grep must confirm (see §11).

### 3.4 `en.ts` strings for the dialog
Add under `en.admin` in [src/lib/i18n/en.ts](../../../src/lib/i18n/en.ts) (no
hardcoded JSX text):
- `compressTitle` — e.g. "Optimize this image?"
- `compressBody` — explains we shrink large images to keep the store fast.
- `compressSizeLabel` / `compressSavedLabel`
- `compressConfirm` ("Upload optimized") / `compressCancel` ("Cancel")
- `compressTooLarge` — over-cap block message, interpolating the MB cap.

### 3.5 Server cap backstop messaging
The 413 already exists in both routes
([products.ts:387-389](../../../worker/routes/admin/products.ts#L387-L389),
[categories.ts:206-208](../../../worker/routes/admin/categories.ts#L206-L208)).
Confirm the message is clear ("Image exceeds 5MB limit") and that
[src/lib/api.ts](../../../src/lib/api.ts) `apiUpload` surfaces the JSON `error`
body to the toast, so a server-side rejection reads cleanly. No new endpoint.
This is the **backstop** — the client block in §3.1 is the primary guard.

---

## 4. Schema / DB

**None.** No D1 schema change, no new columns, no migration. R2 keying and the
`/cdn/*` serving path are unchanged.

---

## 5. Dependencies

- `browser-image-compression` — **already present** and used today (§2). No new
  install. After §3 it is imported from a single module.
- shadcn `Dialog`/`AlertDialog` — already in the repo (`src/components/ui/`).
- No new runtime deps. Fallback (§6) needs **config only**, no package.

---

## 6. Fallback strategy (when client compression underperforms)

Client-side compression can fail or underperform: mobile Safari canvas OOM on
very large images, no AVIF encoder, or a source so large the WebWorker chokes.
**When to switch:** if QA / real-merchant reports show frequent over-cap blocks
(§3.1 step 5) on legitimate photos, OR the AVIF/WebP path silently degrades to
JPEG on a meaningful share of devices.

Two fallback paths, in order of preference (both $0-compatible):

1. **Cloudflare Image transformations on R2** — serve via the transform URL
   format on the `/cdn/*` route (resize/format/quality params), free **5000
   transformations/mo** tier. Upload the original to R2, transform on read. Keeps
   the client simple (no compression at all) but spends the monthly transform
   budget — watch the CF dashboard / budget alert.
2. **Worker-side re-encode** — in the upload routes
   ([products.ts:368-428](../../../worker/routes/admin/products.ts#L368-L428),
   [categories.ts:181-239](../../../worker/routes/admin/categories.ts#L181-L239)),
   re-encode/clamp before `R2.put` so the cap is enforced server-side too.
   No transform budget, but adds Worker CPU per upload (admin-only, low volume —
   acceptable).

Document the chosen trigger and switch in an ADR if/when activated; ship §3 as
the default. **Do not build the fallback in this phase** unless §8 acceptance
reveals client compression genuinely can't hold the cap.

---

## 7. Rollout (small commits)

1. `feat(image): tune compressImage to AVIF/WebP q80, max 2000px`
2. `feat(admin): before/after confirm dialog in shared ImageUpload (>3MB gate)`
3. `feat(admin): client-side hard block when compressed result > MAX_IMAGE_BYTES`
4. `refactor(admin): move product ImageUpload onto shared component`
5. `refactor(admin): move category image upload onto shared component`
6. `i18n(en): strings for the image-compression confirm dialog`
7. `feat(worker): clarify 413 over-cap message + surface error in apiUpload toast`
8. `test(unit): compressImage tuning + formatBytes + threshold gating`
9. `test(component): confirm dialog (silent <3MB, confirm >3MB, block >5MB)`
10. `docs(image): note single upload component + fallback; mark phase-18 done`

Each commit must leave `pnpm verify --quick` green; the final pre-docs commit
must pass full `pnpm verify`.

---

## 8. Acceptance

- Upload a **~10MB** image → confirm dialog appears, shows original vs compressed
  bytes + % saved + a preview thumbnail; nothing uploads until **Upload** clicked.
- Upload a **<3MB** image → compresses **silently**, no dialog, uploads (current
  behavior preserved exactly).
- A pathological source whose compressed result is **still > 5MB** → Upload button
  disabled, over-cap message shown, no request fired.
- Bypassed/forced over-cap request → server returns **413** with a readable
  message that surfaces in the toast (backstop verified).
- Compressed output is **AVIF or WebP** (within `ALLOWED_IMAGE_TYPES`) at
  ≤2000px on the long edge; visually indistinguishable from the source at normal
  viewing.
- **Both** product and category uploads render the **same shared component**;
  `grep` finds `browser-image-compression` imported in **exactly one** file.
- **Regression test** added covering the threshold gate (silent vs confirm vs
  block) per the bug→test discipline in
  [phase-16](../done/phase-16-comprehensive-testing.md#9-regression-discipline).
- `pnpm verify` green (typecheck → lint → unit+coverage ≥95% → integration → build).
- `git status` shows no new tracked build/output files.

---

## 9. Non-goals

- **No true lossless** compression (defeats $0 R2/CDN goal).
- **No** new upload endpoint, no D1 schema change, no R2 key/serving change.
- **No** server-side re-encode or CF Image transformations *in this phase* — §6
  is a documented fallback, activated only if §8 reveals a real need.
- **No** raising `MAX_IMAGE_BYTES` or `MAX_IMAGES_PER_VARIANT`.
- **No** new dependency (reuse `browser-image-compression` + existing shadcn Dialog).
- **No** confirm dialog for sub-threshold images (would annoy merchants on every
  small image).

---

## 10. Docs to update

- [CONTEXT.md](../../../CONTEXT.md) — add an "image optimization" glossary note
  only if a new domain term is introduced (e.g. the 3MB confirm threshold).
- [docs/architecture/dry-conventions.md](../../../docs/architecture/dry-conventions.md)
  — record that **all** admin image uploads go through the single shared
  `ImageUpload` component and the single `compressImage` util (no per-caller
  compression config).
- [README](../../../README.md) — one line under admin/features that large images
  are auto-optimized with a confirm step.
- If §6 fallback is activated, write an ADR under
  [docs/adr/](../../../docs/adr/).
- **Final commit:** `git mv docs/plans/proposed/phase-18-image-compression.md
  docs/plans/done/` and commit as `docs(image): mark phase-18 done`.

---

## 11. Self-audit checklist

- [ ] Shared [ImageUpload.tsx](../../../src/components/shared/ImageUpload.tsx)
  shows before/after sizes + % saved + preview thumbnail in the confirm dialog.
- [ ] Confirm dialog appears **only** when original > 3MB; sub-threshold uploads
  stay silent.
- [ ] Upload is **blocked client-side** when compressed result > `MAX_IMAGE_BYTES`,
  with the `compressTooLarge` message.
- [ ] `compressImage` outputs AVIF/WebP at ~q80, ≤2000px long edge; falls back
  cleanly when AVIF encode unavailable.
- [ ] Both product and category callers refactored onto the shared component;
  old inline `imageCompression(...)` blocks deleted.
- [ ] `grep -rn "browser-image-compression" src` returns **exactly one** file
  (`src/lib/image.ts`) — no duplicate compression config remains.
- [ ] All new UI text lives in [en.ts](../../../src/lib/i18n/en.ts); none hardcoded.
- [ ] Object URLs for previews are revoked (no memory leak).
- [ ] Server 413 message is clear and surfaced to the toast via `apiUpload`.
- [ ] Unit + component tests added; regression test for the threshold gate exists.
- [ ] `pnpm verify` is green end-to-end (coverage ≥95%).
- [ ] No edits to `.next/` / `.open-next/` / `coverage/` / `test-results/`.
- [ ] This plan re-read end-to-end before marking done; then `git mv` to
  `docs/plans/done/`.
