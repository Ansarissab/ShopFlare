'use client'

import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { HelpTipProps } from '@/lib/types/common'

/**
 * The single tooltip-composition site for "what is this?" hints.
 * Use beside field labels, column headers, or metric titles. Copy lives in
 * `en.tooltips.*` — never hardcode the string at the call site.
 *
 * ⚠️ Files importing Recharts already have a `Tooltip` symbol — import THIS
 * helper instead of `@/components/ui/tooltip` to avoid the name collision.
 */
export function HelpTip({ text, side = 'top', className }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={text}
        className={cn('inline-flex text-muted-foreground hover:text-foreground', className)}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent side={side}>{text}</TooltipContent>
    </Tooltip>
  )
}
