// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { matchSequence, isEditableTarget, shouldIgnoreEvent } from './dispatcher'
import type { ShortcutBinding } from '@/lib/types/shortcuts'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const bindings: readonly ShortcutBinding[] = [
  { id: 'search', sequence: ['/'], labelKey: 'shortcuts.search' },
  { id: 'goOrders', sequence: ['g', 'o'], labelKey: 'shortcuts.goOrders' },
  { id: 'goProducts', sequence: ['g', 'p'], labelKey: 'shortcuts.goProducts' },
  { id: 'help', sequence: ['?'], labelKey: 'shortcuts.help' },
]

// ─── matchSequence ────────────────────────────────────────────────────────────

describe('matchSequence', () => {
  it('returns exact for a single-key match', () => {
    expect(matchSequence(['/'], bindings)).toEqual({ type: 'exact', id: 'search' })
  })

  it('returns exact for a multi-key sequence', () => {
    expect(matchSequence(['g', 'o'], bindings)).toEqual({ type: 'exact', id: 'goOrders' })
  })

  it('returns partial for a prefix of a multi-key sequence', () => {
    expect(matchSequence(['g'], bindings)).toEqual({ type: 'partial' })
  })

  it('returns none for a key that matches nothing', () => {
    expect(matchSequence(['x'], bindings)).toEqual({ type: 'none' })
  })

  it('returns none for an empty buffer', () => {
    expect(matchSequence([], bindings)).toEqual({ type: 'none' })
  })

  it('exact takes priority over partial (hypothetical overlap)', () => {
    // A binding set where ['g'] is both exact (for some action) and a prefix.
    const mixed: readonly ShortcutBinding[] = [
      { id: 'create', sequence: ['g'], labelKey: 'shortcuts.create' },
      { id: 'goOrders', sequence: ['g', 'o'], labelKey: 'shortcuts.goOrders' },
    ]
    expect(matchSequence(['g'], mixed)).toEqual({ type: 'exact', id: 'create' })
  })

  it('returns none when buffer overshoots any binding', () => {
    expect(matchSequence(['g', 'o', 'x'], bindings)).toEqual({ type: 'none' })
  })
})

// ─── isEditableTarget ─────────────────────────────────────────────────────────

describe('isEditableTarget', () => {
  it('returns true for input[type=text]', () => {
    const el = document.createElement('input')
    el.type = 'text'
    expect(isEditableTarget(el)).toBe(true)
  })

  it('returns false for input[type=checkbox]', () => {
    const el = document.createElement('input')
    el.type = 'checkbox'
    expect(isEditableTarget(el)).toBe(false)
  })

  it('returns false for input[type=radio]', () => {
    const el = document.createElement('input')
    el.type = 'radio'
    expect(isEditableTarget(el)).toBe(false)
  })

  it('returns false for input[type=button]', () => {
    const el = document.createElement('input')
    el.type = 'button'
    expect(isEditableTarget(el)).toBe(false)
  })

  it('returns false for input[type=submit]', () => {
    const el = document.createElement('input')
    el.type = 'submit'
    expect(isEditableTarget(el)).toBe(false)
  })

  it('returns true for textarea', () => {
    const el = document.createElement('textarea')
    expect(isEditableTarget(el)).toBe(true)
  })

  it('returns true for a contenteditable div', () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    expect(isEditableTarget(el)).toBe(true)
  })

  it('returns false for a plain div', () => {
    const el = document.createElement('div')
    expect(isEditableTarget(el)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isEditableTarget(null)).toBe(false)
  })

  it('returns true for input with no explicit type (defaults to text)', () => {
    const el = document.createElement('input')
    // no .type set → browser defaults to "text"
    expect(isEditableTarget(el)).toBe(true)
  })
})

// ─── shouldIgnoreEvent ────────────────────────────────────────────────────────

describe('shouldIgnoreEvent', () => {
  it('returns true when ctrlKey is held', () => {
    expect(shouldIgnoreEvent({ key: 'k', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
  })

  it('returns true when metaKey is held', () => {
    expect(shouldIgnoreEvent({ key: 'k', ctrlKey: false, metaKey: true, altKey: false })).toBe(true)
  })

  it('returns true when altKey is held', () => {
    expect(shouldIgnoreEvent({ key: 'k', ctrlKey: false, metaKey: false, altKey: true })).toBe(true)
  })

  it('returns false when only shift is held (no ctrl/meta/alt)', () => {
    expect(shouldIgnoreEvent({ key: '?', ctrlKey: false, metaKey: false, altKey: false })).toBe(
      false,
    )
  })

  it('returns false for a plain key with no modifiers', () => {
    expect(shouldIgnoreEvent({ key: '/', ctrlKey: false, metaKey: false, altKey: false })).toBe(
      false,
    )
  })
})
