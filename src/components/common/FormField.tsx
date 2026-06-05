'use client'

import { Label } from '@/components/ui/label'
import { HelpTip } from '@/components/common/HelpTip'
import { en } from '@/lib/i18n/en'
import type { FieldProps } from '@/lib/types/common'

export type { FieldProps }

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
 */
export function FormField({ label, htmlFor, optional = false, error, help, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && (
          <>
            {' '}
            <span className="text-xs text-muted-foreground">{en.common.optional}</span>
          </>
        )}
        {help && <HelpTip text={help} />}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
