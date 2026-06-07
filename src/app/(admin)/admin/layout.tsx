import type { Metadata } from 'next'
import { AdminShell } from '@/components/admin/shared/AdminShell'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  manifest: '/admin-manifest.webmanifest',
}

// Auth + chrome live in the client AdminShell. Security is enforced by the API
// worker (Bearer session token on every /api/admin/* call); the shell only gates
// the UI. Keeping the layout a plain server component lets the admin pages stay
// statically prerendered shells (cheaper) that fetch data client-side.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
