import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminStatCardProps } from '@/lib/types/store'

export function StatCard({ label, value, sub }: AdminStatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}
