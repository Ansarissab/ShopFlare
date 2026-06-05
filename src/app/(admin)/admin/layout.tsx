import type { Metadata } from 'next'
import { AdminSidebar, MobileAdminNav } from '@/components/admin/shared/AdminSidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  manifest: '/admin-manifest.webmanifest',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-auto">
          {/* Mobile-only top bar with hamburger — hidden on md+ where the sidebar shows */}
          <header className="flex h-14 items-center gap-3 border-b px-4 md:hidden">
            <MobileAdminNav />
            <span className="text-sm font-semibold tracking-tight">Admin</span>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}
