'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, Tag, BarChart2, Settings, Monitor, Star, BellRing, FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'

const navItems = [
  { href: '/admin',           label: en.admin.dashboard,      icon: LayoutDashboard },
  { href: '/admin/products',  label: en.admin.products,       icon: Package },
  { href: '/admin/orders',    label: en.admin.orders,         icon: ShoppingCart },
  { href: '/admin/pos',       label: en.admin.pos,            icon: Monitor },
  { href: '/admin/coupons',   label: en.admin.coupons,        icon: Tag },
  { href: '/admin/reviews',   label: en.admin.reviews,        icon: Star },
  { href: '/admin/notify',    label: en.admin.notifyRequests, icon: BellRing },
  { href: '/admin/pages',     label: en.admin.pages,          icon: FileText },
  { href: '/admin/settings',  label: en.admin.settings,       icon: Settings },
  { href: '/admin/analytics', label: en.admin.analytics,      icon: BarChart2 },
] as const

export function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'flex h-full flex-col border-r bg-background transition-all duration-200',
      collapsed ? 'w-14' : 'w-56',
    )}>
      <div className="flex h-14 items-center border-b px-3">
        {!collapsed && (
          <span className="flex-1 text-sm font-semibold tracking-tight">Admin</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed && 'mx-auto',
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="size-4" aria-hidden />
            : <PanelLeftClose className="size-4" aria-hidden />
          }
        </button>
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
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md py-2 text-sm transition-colors',
                collapsed ? 'justify-center px-2' : 'px-3',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {!collapsed && label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
