import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { POSScreen } from '@/components/admin/pos/POSScreen'
import { getT } from '@/lib/i18n/server'

export default async function POSPage() {
  const t = await getT()
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={t.pos.title} />
      <POSScreen />
    </div>
  )
}
