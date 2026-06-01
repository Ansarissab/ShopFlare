import { POSScreen } from '@/components/admin/pos/POSScreen'
import { en } from '@/lib/i18n/en'

export default function POSPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{en.pos.title}</h1>
      <POSScreen />
    </div>
  )
}
