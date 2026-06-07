import type { Metadata } from 'next'
import { AdminSidebar, MobileAdminNav } from '@/components/admin/shared/AdminSidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { isAdminAuthorized } from '@/lib/server/admin-auth'
import { Unauthorized } from '@/components/admin/shared/Unauthorized'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  manifest: '/admin-manifest.webmanifest',
}

// The auth guard reads request headers/cookies (CF Access JWT), so this subtree
// must be dynamic — never statically prerendered. Without this, Next optimizes
// /admin to static at build and throws "static to dynamic at runtime" (500)
// once the guard calls headers()/cookies().
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // App-level guard (defense-in-depth on top of edge CF Access). Render the
  // unauthorized UI inline rather than redirecting — the unauthorized page lives
  // under this same layout, so a redirect would loop.
  if (!(await isAdminAuthorized())) {
    return <Unauthorized />
  }

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
