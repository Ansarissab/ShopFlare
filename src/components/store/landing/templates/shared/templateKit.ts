/**
 * Shared design tokens for landing templates.
 *
 * All three templates (Wise, Stripe, YC) derive their type scale and button
 * classes from here so they stay consistent without duplicating the same
 * strings in each file. Per-template palette and layout decisions live in
 * their own files; only the cross-template constants live here.
 *
 * RULES:
 *  - No hardcoded hex. Only Tailwind theme-token utilities or transparent
 *    opacity modifiers (e.g. text-foreground/70).
 *  - No font-bold / font-extrabold on h1–h4. Headings use Instrument Serif
 *    (globals.css h1–h4 rule) at weight 400; hierarchy comes from size +
 *    tracking + spacing.
 *  - font-semibold is allowed on buttons and labels only.
 */

import { cn } from '@/lib/utils'

// ─── Type scale ──────────────────────────────────────────────────────────────
// Use these className strings on heading elements, not arbitrary font-size
// style props where avoidable. They produce a consistent rhythm across all 3
// templates.

/** Hero <h1> — large display, tight tracking. */
export const heroHeading = 'text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight'

/** Section <h2> — comfortable section-header scale. */
export const sectionHeading = 'text-2xl sm:text-3xl leading-tight tracking-tight'

/** Featured grid <h2> — slightly smaller than a full section header. */
export const featuredHeading = 'text-xl sm:text-2xl tracking-tight'

/** Subtext / body beneath a heading — muted, relaxed line-height. */
export const bodyText = 'text-base sm:text-lg text-muted-foreground leading-relaxed'

// ─── Shared button base ───────────────────────────────────────────────────────
// Templates compose their own flavour (shape, size tweaks) on top of this.

/** Primary CTA pill — `bg-primary text-primary-foreground`. */
export const primaryBtn = cn(
  'inline-flex items-center justify-center font-semibold',
  'transition-opacity hover:opacity-90',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'px-8 py-3.5 text-sm min-h-12 rounded-full',
  'bg-primary text-primary-foreground',
)

/**
 * Accent-flavoured CTA pill.
 *
 * Previously `bg-accent text-accent-foreground` (#4A7C6F / #FAFAF7 ≈ 4.48:1),
 * which fails WCAG 2 AA (4.5 minimum) for normal-size text on a solid fill.
 * Fixed to `bg-primary text-primary-foreground` (near-black/near-white, ~14:1)
 * so every template that imports accentBtn is AA-safe on normal-size labels.
 * Reserve raw `bg-accent` for decorative rules, borders, and large display
 * headings (≥24 px) where the 3:1 large-text threshold applies.
 */
export const accentBtn = cn(
  'inline-flex items-center justify-center font-semibold',
  'transition-opacity hover:opacity-90',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'px-8 py-3.5 text-sm min-h-12 rounded-full',
  'bg-primary text-primary-foreground',
)

/** Ghost/outline secondary button — for use on dark or coloured blocks. */
export const ghostBtn = cn(
  'inline-flex items-center justify-center font-medium text-sm',
  'transition-colors',
  'text-foreground/80 underline-offset-4 hover:text-foreground hover:underline',
)

/** Card/inverse button — white background, foreground text (use on dark blocks). */
export const inverseBtn = cn(
  'inline-flex items-center justify-center font-semibold',
  'transition-opacity hover:opacity-90',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'px-8 py-3.5 text-sm min-h-12 rounded-full',
  'bg-card text-card-foreground shadow-sm',
)

/** Restrained square-ish button — for YC editorial (no pill). */
export const editorialBtn = cn(
  'inline-flex items-center justify-center font-semibold',
  'transition-opacity hover:opacity-85',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'px-7 py-3.5 text-sm tracking-wide min-h-12 rounded-md',
  'bg-primary text-primary-foreground',
)
