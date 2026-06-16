'use client'

import { isValidElement, cloneElement } from 'react'
import { Label } from '@/components/ui/label'
import { HelpTip } from '@/components/common/HelpTip'
import { useT } from '@/lib/i18n/Provider'
import type { FieldProps } from '@/lib/types/common'

export type { FieldProps }

/**
 * Shared form-field wrapper: label + optional marker + input slot + error message.
 *
 * The caller is responsible for wiring register/type/autoComplete/aria-invalid
 * directly on the child <Input>. This component owns only the repetitive shell:
 *   <div flex-col gap-1.5>
 *     <Label> … (optional) </Label>
 *     {children}   ← when error is present, aria-describedby is injected
 *     {error && <p id="${htmlFor}-error" class="text-xs text-destructive">}
 *   </div>
 */
export function FormField({ label, htmlFor, optional = false, error, help, children }: FieldProps) {
  const t = useT()
  const errorId = error ? `${htmlFor}-error` : undefined

  // Inject aria-describedby onto the single child element when an error is present.
  // cloneElement is used only when needed (error exists + child is a valid element)
  // so existing call-sites with no error are unaffected.
  const child =
    error && isValidElement<{ 'aria-describedby'?: string }>(children)
      ? cloneElement(children, { 'aria-describedby': errorId })
      : children

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && (
          <>
            {' '}
            <span className="text-xs text-muted-foreground">{t.common.optional}</span>
          </>
        )}
        {help && <HelpTip text={help} />}
      </Label>
      {child}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
