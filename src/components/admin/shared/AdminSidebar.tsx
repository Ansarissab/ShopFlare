'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, Tag, BarChart2, Settings, Monitor, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'

const navItems = [
  { href: '/admin',          label: en.admin.dashboard, icon: LayoutDashboard },
  { href: '/admin/products', label: en.admin.products,  icon: Package },
  { href: '/admin/orders',   label: en.admin.orders,    icon: ShoppingCart },
  { href: '/admin/pos',      label: en.admin.pos,       icon: Monitor },
  { href: '/admin/coupons',  label: en.admin.coupons,   icon: Tag },
  { href: '/admin/reviews',  label: en.admin.reviews,   icon: Star },
  { href: '/admin/settings', label: en.admin.settings,  icon: Settings },
  { href: '/admin/analytics',label: en.admin.analytics, icon: BarChart2 },
] as const

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold tracking-tight">Admin</span>
      </div>

      <nav className="flex flex-col gap-0.5 p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
