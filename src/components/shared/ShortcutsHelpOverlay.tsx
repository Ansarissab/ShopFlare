'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useT, useLocale } from '@/lib/i18n/Provider'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { LOCALES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ShortcutsHelpOverlayProps } from '@/lib/types/shortcuts'
import type { Dictionary } from '@/lib/i18n/en'

// ─── Key display helpers ──────────────────────────────────────────────────────

const KEY_DISPLAY: Record<string, string> = {
  Escape: 'Esc',
  Enter: '↵',
}

function displayKey(key: string): string {
  if (key in KEY_DISPLAY) return KEY_DISPLAY[key]
  if (key.length === 1) return key.toUpperCase()
  return key
}

// ─── Safe dot-path getter ─────────────────────────────────────────────────────

function getLabel(t: Dictionary, labelKey: string): string {
  const parts = labelKey.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = t
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return labelKey
    node = node[part]
  }
  return typeof node === 'string' ? node : labelKey
}

// ─── ShortcutsHelpOverlay ─────────────────────────────────────────────────────

export function ShortcutsHelpOverlay({ open, onOpenChange, bindings }: ShortcutsHelpOverlayProps) {
  const t = useT()
  const locale = useLocale()
  const reducedMotion = useReducedMotion()
  const dir = LOCALES[locale].dir

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={dir}
        className={cn(
          'sm:max-w-md',
          // When reduced motion is preferred, collapse the transition duration
          // so the overlay appears/disappears instantly.
          reducedMotion && 'duration-0',
        )}
      >
        <DialogHeader>
          <DialogTitle>{t.shortcuts.title}</DialogTitle>
        </DialogHeader>

        <ul role="list" className="flex flex-col gap-1 mt-1">
          {bindings.map((binding) => (
            <li
              key={binding.id}
              className="flex items-center justify-between gap-4 py-1.5 border-b border-border/50 last:border-0"
            >
              {/* Label */}
              <span className="text-sm text-foreground">{getLabel(t, binding.labelKey)}</span>

              {/* Key(s) */}
              <span className="flex items-center gap-1 shrink-0">
                {binding.sequence.map((key, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    {idx > 0 && (
                      <span className="text-xs text-muted-foreground px-0.5">
                        {t.shortcuts.sequenceHint}
                      </span>
                    )}
                    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-sm">
                      {displayKey(key)}
                    </kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

// ─── useShortcutsHelp ─────────────────────────────────────────────────────────

export function useShortcutsHelp() {
  const [open, setOpen] = useState(false)
  return {
    open,
    setOpen,
    openHelp: () => setOpen(true),
    closeHelp: () => setOpen(false),
  }
}
