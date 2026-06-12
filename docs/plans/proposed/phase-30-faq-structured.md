# Phase 30 — FAQ: structured Q/A, dedicated /faq, per-product, accordion

Status: Proposed. Planned 2026-06-12 (grill-with-docs). Depends on
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
