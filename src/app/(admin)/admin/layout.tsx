import { AdminSidebar } from '@/components/admin/shared/AdminSidebar'
import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
