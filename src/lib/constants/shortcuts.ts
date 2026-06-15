import type { ShortcutBinding } from '@/lib/types/shortcuts'

// ─── Store shortcuts ──────────────────────────────────────────────────────────

export const STORE_SHORTCUTS: readonly ShortcutBinding[] = [
  { id: 'search', sequence: ['/'], labelKey: 'shortcuts.search' },
  { id: 'cart', sequence: ['c'], labelKey: 'shortcuts.cart' },
  { id: 'help', sequence: ['?'], labelKey: 'shortcuts.help' },
  { id: 'close', sequence: ['Escape'], labelKey: 'shortcuts.close' },
] as const

// ─── Admin shortcuts ──────────────────────────────────────────────────────────

export const ADMIN_SHORTCUTS: readonly ShortcutBinding[] = [
  { id: 'goOrders', sequence: ['g', 'o'], labelKey: 'shortcuts.goOrders' },
  { id: 'goProducts', sequence: ['g', 'p'], labelKey: 'shortcuts.goProducts' },
  { id: 'goCoupons', sequence: ['g', 'c'], labelKey: 'shortcuts.goCoupons' },
  { id: 'goAnalytics', sequence: ['g', 'a'], labelKey: 'shortcuts.goAnalytics' },
  { id: 'create', sequence: ['c'], labelKey: 'shortcuts.create' },
  { id: 'search', sequence: ['/'], labelKey: 'shortcuts.search' },
  { id: 'listNext', sequence: ['j'], labelKey: 'shortcuts.listNext' },
  { id: 'listPrev', sequence: ['k'], labelKey: 'shortcuts.listPrev' },
  { id: 'listOpen', sequence: ['Enter'], labelKey: 'shortcuts.listOpen' },
  { id: 'help', sequence: ['?'], labelKey: 'shortcuts.help' },
  { id: 'close', sequence: ['Escape'], labelKey: 'shortcuts.close' },
] as const

// ─── Admin create routes ──────────────────────────────────────────────────────
// Maps a list-page path to its corresponding /new route.
// Pressing 'c' on a path with an entry navigates there; no-op otherwise.

export const ADMIN_CREATE_ROUTES: Record<string, string> = {
  '/admin/products': '/admin/products/new',
  '/admin/categories': '/admin/categories/new',
} as const
