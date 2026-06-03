import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminStatCardProps } from '@/lib/types/admin'

export function StatCard({ label, value, sub, href }: AdminStatCardProps) {
  const content = (
    <Card className={href ? 'transition-colors hover:bg-muted/50 cursor-pointer' : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )

  if (href) return <Link href={href}>{content}</Link>
  return content
}
