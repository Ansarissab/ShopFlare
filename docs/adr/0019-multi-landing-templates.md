---
status: accepted
date: 2026-06-17
---
# ADR 0019: Multiple Selectable Landing Pages with Template Registry

## Context

The original landing page was a single config: one set of section rows stored in
`landing_content` and `featured_products`. There was no way to have distinct landing
experiences or switch between them without a code change and redeploy.

Two requirements drove the change:

1. **Multiple landing pages** — a merchant may want an "A" layout for a campaign and a
   default layout for everyday use, switchable from admin with no redeploy.
2. **Distinct visual designs** — different page structures and layout personalities that
   still respect the store's own theme tokens (colors, fonts, radius, density) rather than
   hardcoded brand palettes.

## Decision

### Data model

A `landing_pages` table is added (`id`, `name`, `template`, `isActive`, `sortOrder`).
`landing_content` and `featured_products` gain a `landing_page_id` foreign key, forming a
composite primary key with their existing keys. Exactly one active page is enforced
server-side (activating a page deactivates all others in the same transaction).

Migration `0011` creates an active `lp_default` row using the `classic` template and
backfills all existing `landing_content` and `featured_products` rows to it — no data is
lost.

### Template registry

A `template` column (string enum: `classic | wise | stripe | yc`) on `landing_pages` maps
to a React component via `LANDING_TEMPLATE_REGISTRY` in
`src/components/store/landing/templates/registry.ts`. The registry is a `Record<LandingTemplate, ComponentType<LandingTemplateProps>>` exhaustive over the `LandingTemplate` type, so
adding a new template key to the type causes a compile error until a component is wired in.

### Shared kit

All four templates compose from a shared primitive kit at
`src/components/store/landing/templates/shared/`:

- `TemplateSection` — the outer section wrapper (padding, background, id anchor).
- `FeaturedGrid` — the product card grid, shared across every template.
- `templateKit` (`templateKit.ts`) — type-scale tokens and button-style helpers derived
  from the store's CSS variable theme; templates use these rather than hardcoding sizes or
  colors.

Templates are designed to preserve the layout personality and structural essence of the
design they reference (Wise — clean whitespace, Stripe — banded sections, YC — dense
editorial), not to copy any actual brand colors. All theme colors come from the store's
CSS variable engine, which is already WCAG-AA verified by the Style Preset system.

### Admin integration

The admin landing editor lists all pages, lets the merchant create/rename/delete pages,
set which template each uses, and toggle which is active — all persisted in D1, no
redeploy needed.

## Consequences

- **No data loss on upgrade**: migration backfills existing rows to `lp_default`.
- **Exactly one active page** at all times, enforced server-side (not client trust).
- **Adding a template** requires one component file + one registry entry. The exhaustive
  `Record` type guarantees it compiles only when both are present.
- **DRY preserved**: all templates share the same data model, the same `LandingTemplateProps`
  interface, and the `TemplateSection`/`FeaturedGrid`/`templateKit` kit. No per-template
  duplication of fetch logic, types, or style primitives.
- **No redeploy for switching**: picking a different template or a different active page is
  a D1 write from admin, consistent with the Dynamic-First rule (ADR 0003).

## Related

- [ADR 0003](./0003-dynamic-config-no-redeploy.md) — Dynamic-First rule; anything a
  non-developer needs to change must live in D1 and be editable from admin.
- [ADR 0012](./0012-trix-html-content.md) — section bodies are still Trix HTML,
  sanitized via the shared `sanitizeHtml` path.
- [ADR 0018](./0018-edge-safe-html-sanitization.md) — the edge-safe sanitizer that keeps
  the frontend worker within the free-plan size limit.
