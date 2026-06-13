import type { Metadata } from 'next'
import { AdminShell } from '@/components/admin/shared/AdminShell'
import { TProvider } from '@/lib/i18n/Provider'
import { getLocaleHeader } from '@/lib/i18n/server'
import { DEFAULT_LOCALE } from '@/lib/constants'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  manifest: '/admin-manifest.webmanifest',
}

// Auth + chrome live in the client AdminShell. Security is enforced by the API
// worker (Bearer session token on every /api/admin/* call); the shell only gates
// the UI. Locale is resolved from the x-locale header set by middleware (which
// strips /{loc} prefixes including /fr/admin, /ur/admin). Admin stays LTR even
// on RTL locales — RTL admin layout is deferred.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocaleHeader()) ?? DEFAULT_LOCALE

  return (
    <TProvider locale={locale}>
      <div lang={locale} dir="ltr">
        <AdminShell>{children}</AdminShell>
      </div>
    </TProvider>
  )
}
