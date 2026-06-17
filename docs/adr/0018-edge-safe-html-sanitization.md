---
status: accepted
date: 2026-06-17
---
# ADR 0018: Replace isomorphic-dompurify with js-xss for Edge-Safe HTML Sanitization

## Context

HTML sanitization is required before any merchant-authored content is rendered — blog
post bodies, landing-page section bodies, product descriptions, policy pages. ADR 0012
recorded using DOMPurify (via `isomorphic-dompurify`) for this.

`isomorphic-dompurify` bundles `jsdom` as its server-side DOM implementation so DOMPurify
has a `window`/`document` to work with. `jsdom` is a full DOM implementation: it adds
multiple MB to a bundle. When OpenNext packages the Next.js SSR app into a Cloudflare
Worker, it bundles every import used in the SSR render path. The result pushed the
frontend worker (`shopflare-web`) to **~3.6 MB gzip**, which exceeds Cloudflare's
**3 MiB Worker size limit on the free plan**. `pnpm web:deploy` failed at the upload step.

## Decision

Replace `isomorphic-dompurify` + its `jsdom` dependency with
[`js-xss`](https://github.com/leizongmin/js-xss) — a pure-JS allowlist sanitizer with no
DOM dependency. It runs in any runtime: Cloudflare Workers (workerd), Node.js, and the
browser.

The sanitizer lives in one module, `src/lib/sanitize.ts`, which exports a single
`sanitizeHtml(dirty: string): string` function. The existing `src/lib/html.ts` re-exports
it so callers don't change. `src/components/shared/RenderHtml.tsx` (the SSR render
component) continues to call `sanitizeHtml` through `html.ts`; the worker write path
(landing routes, blog routes) also imports from `@/lib/html`.

`jsdom` stays as a **devDependency** only — Vitest uses it as a test environment (`jsdom`
project in `vitest.config.ts`). It is never imported by application code, so it is never
bundled.

The allowlist mirrors Trix output exactly (block elements, inline formatting, links,
images). `javascript:` and `data:` URIs are blocked on `href` and `src`; anchors are
forced to `rel="nofollow noopener" target="_blank"`.

## Consequences

- **Worker size dropped from ~3.6 MB to ~2.3 MB gzip** — comfortably under the 3 MiB
  free-plan limit. `pnpm web:deploy` succeeds. $0 hosting preserved.
- Sanitization behavior is equivalent: script/style bodies stripped, iframe/object/embed
  not in the allowlist (stripped), `javascript:`/`data:` URIs blocked, anchors forced safe.
- A single source of truth for sanitization remains (`src/lib/sanitize.ts`). No callsite
  changes needed.
- Heavy client-only libraries (recharts, trix, embla) must stay behind a `'use client'`
  boundary and a dynamic import so they do not enter the SSR bundle. This incident is the
  standing reminder.
- The DOMPurify CVE-2025-26791 mXSS fix (ADR 0012) is no longer relevant to the
  sanitizer; js-xss's allowlist approach is not subject to the same mutation-XSS class
  of issue.

## Related

- [ADR 0012](./0012-trix-html-content.md) — original decision to sanitize merchant HTML;
  DOMPurify chosen there.
- [ADR 0009](./0009-opennext-ssr-worker-not-static-pages.md) — why the frontend runs as a
  Worker (OpenNext), which is why bundle size matters at all.
