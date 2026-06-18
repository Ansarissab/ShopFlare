'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AdminSidebar, MobileAdminNav } from '@/components/admin/shared/AdminSidebar'
import { ListNavProvider } from '@/components/admin/shared/ListNavContext'
import AdminShortcuts from '@/components/admin/shared/AdminShortcuts'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getAdminToken, isAdminDevBypass } from '@/lib/api'

// Read the admin token without a setState-in-effect cascade or a hydration
// mismatch: the server snapshot is always null, the client snapshot reads
// localStorage. Navigation re-renders re-read the snapshot, so the post-login
// redirect picks up the freshly stored token.
const NOOP_UNSUBSCRIBE = () => () => {}
function useAdminToken(): string | null {
  return useSyncExternalStore(NOOP_UNSUBSCRIBE, getAdminToken, () => null)
}

// Client-side admin gate + chrome.
//
// Security is enforced by the API worker (every /api/admin/* call needs a valid
// Bearer token). This gate is UX: it redirects to /admin/login when no token is
// present so the merchant isn't shown an empty dashboard. The admin pages fetch
// all data via the API, so the static shell carries no protected data itself.
//
// Dev bypass: when isAdminDevBypass() is true (NODE_ENV=development +
// NEXT_PUBLIC_ADMIN_DEV_BYPASS=1), the login redirect is skipped entirely so the
// dashboard renders without a real token. This mirrors the backend bypass in
// worker/lib/access.ts and is inert in production builds.
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const token = useAdminToken()
  const isLogin = pathname === '/admin/login'
  const devBypass = isAdminDevBypass()

  // Gate the redirect on client mount. During hydration useSyncExternalStore still
  // returns the server snapshot (null), so without this an already-logged-in user
  // who hard-refreshes or opens an /admin/* URL directly would be bounced to login
  // before the client snapshot reads their token from localStorage.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isLogin && !token && !devBypass) router.replace('/admin/login')
  }, [mounted, isLogin, token, devBypass, router])

  // Login page renders bare — no sidebar chrome, no token required.
  if (isLogin) return <>{children}</>

  // No token and dev bypass is off → render nothing while the effect redirects
  // (avoids a flash of the dashboard). Dev bypass skips this guard so the
  // dashboard renders immediately without waiting for a real token.
  if (!token && !devBypass) return null

  return (
    <TooltipProvider delay={200}>
      <ListNavProvider>
        <div className="flex h-screen overflow-hidden">
          <AdminSidebar />
          <div className="flex flex-1 flex-col overflow-auto">
            {/* Mobile-only top bar with hamburger — hidden on md+ where the sidebar shows */}
            <header className="flex h-14 items-center gap-3 border-b px-4 md:hidden">
              <MobileAdminNav />
              <span className="text-sm font-semibold tracking-tight">Admin</span>
            </header>
            <main className="p-4 sm:p-6">{children}</main>
          </div>
        </div>
        <AdminShortcuts />
      </ListNavProvider>
    </TooltipProvider>
  )
}
