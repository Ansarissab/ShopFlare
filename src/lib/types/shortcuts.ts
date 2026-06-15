// ─── Keyboard shortcut types ─────────────────────────────────────────────────

export type ShortcutScope = 'store' | 'admin'

export type ShortcutActionId =
  | 'search'
  | 'cart'
  | 'help'
  | 'close'
  | 'goOrders'
  | 'goProducts'
  | 'goCoupons'
  | 'goAnalytics'
  | 'create'
  | 'listNext'
  | 'listPrev'
  | 'listOpen'

export interface ShortcutBinding {
  id: ShortcutActionId
  /** Ordered list of event.key values that form the chord/sequence. */
  sequence: readonly string[]
  /** Dot-path into the i18n shortcuts dictionary, e.g. 'shortcuts.search'. */
  labelKey: string
}

/** Props for the ShortcutsHelpOverlay component. */
export interface ShortcutsHelpOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bindings: readonly ShortcutBinding[]
}

/** Partial map of action → handler. Missing entries are no-ops. */
export type ShortcutHandlers = Record<ShortcutActionId, (() => void) | undefined>

export type MatchResult =
  | { type: 'exact'; id: ShortcutActionId }
  | { type: 'partial' }
  | { type: 'none' }

// ─── List navigation context ──────────────────────────────────────────────────

/** Controller registered by a list table so the global shortcut engine can
 * delegate j/k/Enter to whichever list is currently mounted. */
export interface ListNavController {
  next(): void
  prev(): void
  open(): void
}
