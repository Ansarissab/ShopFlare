'use client'

// TODO: move FieldProps to lib/types/store.ts

import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

export interface FieldProps {
  /** Text content of the <label>. */
  label: string
  /** Passed to htmlFor on <Label> and expected as id on the child <Input>. */
  htmlFor: string
  /** When true, appends an "(optional)" muted span after the label text. */
  optional?: boolean
  /** Validation error message. When defined (non-empty) the error <p> renders. */
  error?: string
  /** The <Input> (or any input element) to render inside the field wrapper. */
  children: ReactNode
}

/**
 * Shared form-field wrapper: label + optional marker + input slot + error message.
 *
 * The caller is responsible for wiring register/type/autoComplete/aria-invalid
 * directly on the child <Input>. This component owns only the repetitive shell:
 *   <div flex-col gap-1.5>
 *     <Label> … (optional) </Label>
 *     {children}
 *     {error && <p class="text-xs text-destructive">}
 *   </div>
 *
 * "(optional)" literal has no key in en.ts — kept inline until a key is added.
 */
export function FormField({ label, htmlFor, optional = false, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && (
          <>
            {' '}
            <span className="text-xs text-muted-foreground">(optional)</span>
          </>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
