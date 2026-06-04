import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { POSScreen } from '@/components/admin/pos/POSScreen'
import { en } from '@/lib/i18n/en'

export default function POSPage() {
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={en.pos.title} />
      <POSScreen />
    </div>
  )
}
