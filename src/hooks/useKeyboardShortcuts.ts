'use client'
import { useEffect, useRef } from 'react'
import type { ShortcutBinding, ShortcutHandlers } from '@/lib/types/shortcuts'
import { isEditableTarget, matchSequence, shouldIgnoreEvent } from '@/lib/keyboard/dispatcher'

export interface UseKeyboardShortcutsOpts {
  bindings: readonly ShortcutBinding[]
  handlers: ShortcutHandlers
  /** Set to false to fully disable the listener. Defaults to true. */
  enabled?: boolean
  /** Milliseconds before an incomplete sequence is cleared. Defaults to 1000. */
  timeoutMs?: number
}

/**
 * Attaches a single keydown listener to window and dispatches keyboard
 * shortcuts based on the provided bindings + handlers map.
 * Pure engine — does not render anything.
 */
export function useKeyboardShortcuts({
  bindings,
  handlers,
  enabled = true,
  timeoutMs = 1000,
}: UseKeyboardShortcutsOpts): void {
  // Stable refs so the effect never re-binds on every render.
  const bindingsRef = useRef(bindings)
  const handlersRef = useRef(handlers)
  const bufferRef = useRef<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep refs in sync without re-running the effect.
  useEffect(() => {
    bindingsRef.current = bindings
  }, [bindings])

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!enabled) return

    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    function clearBuffer() {
      clearTimer()
      bufferRef.current = []
    }

    function startTimer() {
      clearTimer()
      timerRef.current = setTimeout(clearBuffer, timeoutMs)
    }

    function fireHandler(id: keyof ShortcutHandlers, e: KeyboardEvent): boolean {
      const handler = handlersRef.current[id]
      if (handler) {
        e.preventDefault()
        handler()
        return true
      }
      return false
    }

    function tryMatch(e: KeyboardEvent): void {
      const result = matchSequence(bufferRef.current, bindingsRef.current)

      if (result.type === 'exact') {
        fireHandler(result.id, e)
        clearBuffer()
        return
      }

      if (result.type === 'partial') {
        startTimer()
        return
      }

      // 'none' — reset to the current key and re-evaluate once so a fresh
      // key that starts a new sequence is not swallowed.
      bufferRef.current = [e.key]
      const retry = matchSequence(bufferRef.current, bindingsRef.current)
      if (retry.type === 'exact') {
        fireHandler(retry.id, e)
        clearBuffer()
      } else if (retry.type === 'partial') {
        startTimer()
      } else {
        clearBuffer()
      }
    }

    function onKeyDown(e: KeyboardEvent): void {
      // 1. Modifier-held keys are always ignored.
      if (shouldIgnoreEvent(e)) return

      // 2. Escape fires close even inside inputs — check before input guard.
      if (e.key === 'Escape') {
        const handler = handlersRef.current['close']
        if (handler) {
          e.preventDefault()
          handler()
        }
        clearBuffer()
        return
      }

      // 3. Ignore typing in form fields.
      if (isEditableTarget(e.target)) return

      // 4. Append key and evaluate.
      bufferRef.current = [...bufferRef.current, e.key]
      tryMatch(e)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearBuffer()
    }
  }, [enabled, timeoutMs])
}
