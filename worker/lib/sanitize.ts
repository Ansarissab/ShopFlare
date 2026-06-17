// Write-path sanitizer for admin content stored in D1.
// Delegates to the shared edge-safe allowlist sanitizer in src/lib/sanitize.ts
// which uses js-xss (pure-JS, no DOM globals, workerd-compatible).
// Both the render path (RenderHtml) and write path now share ONE allowlist.
export { sanitizeHtml } from '@/lib/sanitize'
