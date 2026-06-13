import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { ProductForm } from '@/components/admin/products/ProductForm'
import { getT } from '@/lib/i18n/server'

export default async function NewProductPage() {
  const t = await getT()
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={t.admin.addProduct} backHref="/admin/products" />
      <ProductForm />
    </div>
  )
}
