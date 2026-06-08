# 12. Merchant rich content is authored with Trix and stored as sanitized HTML

Date: 2026-06-08
Status: Accepted

## Context

The blog (#8) and the editable landing page (#3) need formatted, merchant-authored
content, and the existing policy-page editor stores plain text rendered with
`whitespace-pre-wrap` (no formatting). The merchant is a non-developer and must publish
without a redeploy (Dynamic-First rule), which rules out file-based MDX in the repo.

Candidate formats: plain text (too limited), Markdown (needs an editor + parser; non-devs
fumble syntax), MDX (developer-only, requires redeploy), or rich HTML via a WYSIWYG. The
user chose Trix (https://trix-editor.org) to be used everywhere. Trix is a small embedded
WYSIWYG that emits HTML and handles image attachments.

## Decision

Use a single shared `<RichText>` Trix wrapper for all merchant rich content — blog post
bodies, policy pages (migrated from plain text), landing-page section bodies, and product
descriptions. Content is stored as **HTML in D1** and rendered through one shared
`sanitizeHtml()` (DOMPurify, pinned ≥ 3.2.4 for the CVE-2025-26791 mXSS fix), run
server-side so sanitized HTML is present in the SSR output (consistent with ADR 0011).

Trix image attachments upload to R2 through the shared image compress+upload path and are
referenced by `<img src=/cdn/...>`, **not** embedded as base64 (base64 bloats content
+33%, defeats caching, and drops images out of image search). Product descriptions, where
plain text is needed (JSON-LD, meta description), get a tag-stripped projection.

## Consequences

- One editor, one renderer, one sanitizer reused across four content surfaces (DRY).
- Existing plain-text policy content is migrated to HTML (wrapped in `<p>`), preserved.
- Stored HTML is untrusted input → sanitization on render is mandatory; SVG attachments
  (if allowed) are sanitized and served via `<img>`.
- Harder to reverse than markdown: switching formats later means migrating stored HTML.
  Accepted because HTML is the lowest-friction format for non-dev merchants and renders
  directly server-side.
- Adds DOMPurify (+ a Trix client asset) to the bundle; Trix is lightweight and loaded
  only in admin authoring contexts.
</content>
