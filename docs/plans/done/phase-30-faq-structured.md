# Phase 30 — FAQ: structured Q/A, dedicated /faq, per-product, accordion

Status: Done (2026-06-14). Planned 2026-06-12 (grill-with-docs). Depends on
[Phase 28](./phase-28-i18n-locale-engine.md) (chrome strings) and
[Phase 29](./phase-29-header-search-nav-announcement.md) (the FAQ nav link). See
[roadmap](./phases-27-33-roadmap.md).

Replaces today's single `faqContent` RichText blob + `parseFaq` (`src/lib/html.ts`) + `<dl>`
(`src/components/store/FaqSection.tsx`).

## Steps

1. **Data model.** `faqItems: [{ question, answer }]` (answer = Rich Text) on Store Config
   **and** per-Product. Admin gets add/remove/reorder rows for each scope.
2. **Migration.** One-time: seed structured rows from existing `config.faqContent` via the
   current `parseFaq`, then retire the blob field + its admin RichText input
   (`src/app/(admin)/admin/settings/page.tsx`).
3. **Render.** Modern accordion, **multi-open** (better for Ctrl+F / SEO), RTL-aware.
   Replaces `FaqSection`'s `<dl>`.
4. **Routes.** Dedicated **`/faq`** page (store-wide FAQ; header nav target from Phase 29;
   in sitemap). Each Product page shows its own FAQ accordion below the description (shown
   when the Product has items).
5. **Structured data.** Emit FAQ JSON-LD on `/faq` and per-Product (reuse `faqPageJsonLd`
   in `src/lib/seo/jsonld.ts`). Store-wide FAQ stays Feature-Flag-gated (`faqEnabled`).

## Notes

- FAQ text is Merchant content → not Locale-translated this phase (future Workers AI phase).
- Matches the `FAQ` term added to CONTEXT.md.

## Done when

`/faq` renders the store accordion, products render their own, old blob migrated + removed,
JSON-LD emitted, gates green.

## As-built (deviations from plan)

- **Storage:** `faqItems` is a JSON array, not a relational `faq_items` table — store-wide
  in `store_config` (key `faqItems`, mirrors the AnnouncementControls pattern) and per-Product
  in a new `products.faq_items` TEXT/JSON column (migration `0010_useful_luminals.sql`).
- **Migration:** read-time fallback in `worker/routes/config.ts` (derives items from legacy
  `faqContent` via the parser when `faqItems` is empty) + admin pre-seed on settings load.
  `faqContent` left in the schema as deprecated/optional for the backfill read; admin RichText
  input removed and the blob is no longer written.
- **Parser DRY:** pure, DOM-free `parseFaqHtml` extracted to `src/lib/faq.ts` (workerd-safe),
  re-exported by `src/lib/html.ts` as `parseFaq`; worker imports it instead of an inlined copy.
- **Accordion:** multi-open via the `@base-ui-components` `multiple` prop (not `openMultiple`).
- **JSON-LD answers:** rendered as Rich Text via `RenderHtml`, but emitted to FAQ JSON-LD as
  plain text via a new `stripHtml` helper in `src/lib/html.ts`.
- **Toggle:** store-wide FAQ gated by `faqEnabled` (page + nav + sitemap); per-Product FAQ
  shows whenever the Product has items (no separate flag).
