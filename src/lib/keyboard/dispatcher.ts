import type { ShortcutBinding, MatchResult } from '@/lib/types/shortcuts'

// ─── Pure keyboard dispatcher (framework-agnostic) ────────────────────────────

/** Input-like element types that should suppress shortcut handling while focused. */
const BLOCKED_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'number',
  'password',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'color',
])

/**
 * Returns true when the event target is an editable field.
 * Excludes checkbox/radio/button/submit — those are non-text inputs.
 * Handles null and non-HTMLElement targets defensively.
 */
export function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  // jsdom doesn't implement isContentEditable — check the attribute directly.
  if (el.isContentEditable || el.contentEditable === 'true') return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text'
    return BLOCKED_INPUT_TYPES.has(type)
  }
  return false
}

/**
 * Matches the current key buffer against the registered bindings.
 * Exact match takes priority over partial prefix.
 */
export function matchSequence(
  buffer: readonly string[],
  bindings: readonly ShortcutBinding[],
): MatchResult {
  if (buffer.length === 0) return { type: 'none' }

  let hasPartial = false

  for (const binding of bindings) {
    const seq = binding.sequence

    // Check exact: lengths equal AND every element matches.
    if (seq.length === buffer.length) {
      if (seq.every((key, i) => key === buffer[i])) {
        return { type: 'exact', id: binding.id }
      }
    }

    // Check strict prefix: binding is longer AND buffer is a prefix of it.
    if (seq.length > buffer.length) {
      if (buffer.every((key, i) => seq[i] === key)) {
        hasPartial = true
      }
    }
  }

  return hasPartial ? { type: 'partial' } : { type: 'none' }
}

/**
 * Returns true when a modifier key (Ctrl/Meta/Alt) is held.
 * Shift alone is allowed so `?` (shift+/) can be captured.
 */
export function shouldIgnoreEvent(e: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): boolean {
  return e.ctrlKey || e.metaKey || e.altKey
}
