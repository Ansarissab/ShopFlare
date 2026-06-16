import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpTip } from '@/components/common/HelpTip'
import { cn } from '@/lib/utils'
import type { AdminStatCardProps } from '@/lib/types/admin'

export function StatCard({ label, value, sub, href, help, mono }: AdminStatCardProps) {
  // A help icon is a button; nesting it inside the card-wide <Link> (href cards)
  // would be invalid HTML, so only render the tooltip on non-link cards.
  const content = (
    <Card className={href ? 'transition-colors hover:bg-muted/50 cursor-pointer' : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {label}
          {help && !href && <HelpTip text={help} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            'text-2xl sm:text-3xl font-semibold tracking-tight',
            mono && 'font-geist-mono',
          )}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )

  if (href) return <Link href={href}>{content}</Link>
  return content
}
