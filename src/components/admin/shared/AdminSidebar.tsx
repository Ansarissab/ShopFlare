'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tag,
  BarChart2,
  Settings,
  Monitor,
  Star,
  BellRing,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  FolderTree,
  Layers,
  Newspaper,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { AdminLocaleSwitcher } from '@/components/admin/AdminLocaleSwitcher'
// Stable module-scope data — no string values, so safe outside a component
const NAV_ITEMS: { href: string; labelKey: string; icon: React.ElementType }[] = [
  { href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/products', labelKey: 'products', icon: Package },
  { href: '/admin/categories', labelKey: 'categories', icon: FolderTree },
  { href: '/admin/orders', labelKey: 'orders', icon: ShoppingCart },
  { href: '/admin/pos', labelKey: 'pos', icon: Monitor },
  { href: '/admin/coupons', labelKey: 'coupons', icon: Tag },
  { href: '/admin/reviews', labelKey: 'reviews', icon: Star },
  { href: '/admin/notify', labelKey: 'notifyRequests', icon: BellRing },
  { href: '/admin/landing', labelKey: 'landingPage', icon: Layers },
  { href: '/admin/blog', labelKey: 'blog', icon: Newspaper },
  { href: '/admin/pages', labelKey: 'pages', icon: FileText },
  { href: '/admin/settings', labelKey: 'settings', icon: Settings },
  { href: '/admin/analytics', labelKey: 'analytics', icon: BarChart2 },
]

// Shared nav list — used in both the desktop aside and the mobile Sheet drawer
function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const t = useT()

  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const label = t.admin[labelKey as keyof typeof t.admin] as string
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            onClick={onNavigate}
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
  )
}

// Shared "View store" button — used in both desktop footer and mobile sheet
function ViewStoreButton({ collapsed = false }: { collapsed?: boolean }) {
  const t = useT()
  const label = t.admin.viewStore

  function handleClick() {
    window.open(`/?_cb=${Date.now()}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md py-2 text-sm transition-colors text-muted-foreground hover:bg-muted hover:text-foreground',
        collapsed ? 'justify-center px-2' : 'px-3',
      )}
    >
      <Store className="size-4 shrink-0" aria-hidden />
      {!collapsed && label}
    </button>
  )
}

// Mobile hamburger + Sheet drawer — visible only below md
export function MobileAdminNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent side="left" className="w-56 p-0">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold tracking-tight">Admin</span>
          <AdminLocaleSwitcher />
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
        <div className="border-t p-3">
          <ViewStoreButton />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Desktop persistent sidebar — hidden below md
export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'hidden md:flex h-full flex-col border-r bg-background transition-all duration-200',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <div className="flex h-14 items-center border-b px-3">
        {!collapsed && <span className="flex-1 text-sm font-semibold tracking-tight">Admin</span>}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            collapsed && 'mx-auto',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden />
          )}
        </button>
      </div>

      <SidebarNav collapsed={collapsed} />

      {/* Sidebar footer — view store + locale switcher */}
      <div className="mt-auto border-t p-3 flex flex-col gap-1">
        <ViewStoreButton collapsed={collapsed} />
        {!collapsed && <AdminLocaleSwitcher />}
      </div>
    </aside>
  )
}
