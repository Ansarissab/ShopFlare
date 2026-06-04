import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { ProductForm } from '@/components/admin/products/ProductForm'
import { en } from '@/lib/i18n/en'

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={en.admin.addProduct} backHref="/admin/products" />
      <ProductForm />
    </div>
  )
}
