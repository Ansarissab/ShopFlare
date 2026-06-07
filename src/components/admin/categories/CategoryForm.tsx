'use client'

/* eslint-disable react-hooks/incompatible-library -- react-hook-form's watch() returns a
   function the React Compiler can't memoize; skipping memoization here is expected. */

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormField } from '@/components/common/FormField'
import { en } from '@/lib/i18n/en'
import { apiPost, apiPut, ApiError } from '@/lib/api'
import { slugify } from '@/lib/utils/index'
import { createCategorySchema } from '@/lib/schemas/admin'
import type { CategoryFormProps } from '@/lib/types/category'

// Use the output type (after defaults) as the form's value type so
// description/sortOrder/active always resolve to concrete types.
interface CategoryFormValues {
  name: string
  slug?: string
  description: string
  parentId?: string | null
  sortOrder: number
  active: boolean
}

export function CategoryForm({ category, parentOptions, onSuccess }: CategoryFormProps) {
  const isEdit = Boolean(category)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createCategorySchema) as any,
    defaultValues: {
      name:        category?.name        ?? '',
      slug:        category?.slug        ?? '',
      description: category?.description ?? '',
      parentId:    category?.parentId    ?? null,
      sortOrder:   category?.sortOrder   ?? 0,
      active:      category?.active      ?? true,
    },
  })

  const nameValue = watch('name')
  const slugValue = watch('slug')
  const activeValue = watch('active')

  // Auto-fill slug from name in create mode only when slug is still unedited
  useEffect(() => {
    if (!isEdit) {
      const currentSlug = slugValue ?? ''
      // Only override if current slug is either empty or matches auto from previous name
      if (currentSlug === '' || slugify(nameValue ?? '') !== currentSlug) {
        // No-op here — handled in onChange below
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value
    // In create mode: keep slug in sync while user hasn't manually changed it
    if (!isEdit) {
      const prevAutoSlug = slugify(nameValue ?? '')
      const current = slugValue ?? ''
      if (current === '' || current === prevAutoSlug) {
        setValue('slug', slugify(newName), { shouldValidate: false })
      }
    }
  }

  async function onSubmit(data: CategoryFormValues) {
    try {
      if (isEdit && category?.id) {
        await apiPut(`/api/admin/categories/${category.id}`, data)
        toast.success(en.admin.categoryUpdated)
      } else {
        await apiPost('/api/admin/categories', data)
        toast.success(en.admin.categoryCreated)
      }
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('slug', { message: en.admin.slugTaken })
          return
        }
        if (err.status === 422) {
          const body = err.body as { field?: string; message?: string } | undefined
          if (body?.field === 'parentId') {
            setError('parentId', { message: body.message ?? 'Invalid parent' })
            return
          }
        }
      }
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    }
  }

  // Exclude self from parent options on edit
  const filteredParentOptions = isEdit && category
    ? parentOptions.filter((c) => c.id !== category.id)
    : parentOptions

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-2xl">
      <FormField label={en.admin.categoryName} htmlFor="cat-name" error={errors.name?.message}>
        <Input
          id="cat-name"
          {...register('name', {
            onChange: handleNameChange,
          })}
          aria-invalid={!!errors.name}
          placeholder="e.g. Summer Collection"
        />
      </FormField>

      <FormField
        label={en.admin.categorySlug}
        htmlFor="cat-slug"
        error={errors.slug?.message}
        help={en.admin.slugAutoHint}
      >
        <Input
          id="cat-slug"
          {...register('slug')}
          aria-invalid={!!errors.slug}
          placeholder="e.g. summer-collection"
        />
      </FormField>

      <FormField
        label={en.admin.categoryDescription}
        htmlFor="cat-desc"
        error={errors.description?.message}
        optional
      >
        <Textarea
          id="cat-desc"
          {...register('description')}
          rows={3}
          className="resize-none"
          placeholder="Optional description shown on the category page"
        />
      </FormField>

      <FormField label={en.admin.categoryParent} htmlFor="cat-parent" error={errors.parentId?.message}>
        <Select
          defaultValue={category?.parentId ?? '__none__'}
          onValueChange={(val) =>
            setValue('parentId', val === '__none__' ? null : val, { shouldValidate: true })
          }
        >
          <SelectTrigger id="cat-parent">
            <SelectValue placeholder={en.admin.categoryParentNone} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{en.admin.categoryParentNone}</SelectItem>
            {filteredParentOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label={en.admin.categorySortOrder} htmlFor="cat-sort" error={errors.sortOrder?.message}>
        <Input
          id="cat-sort"
          type="number"
          min={0}
          {...register('sortOrder', { valueAsNumber: true })}
          aria-invalid={!!errors.sortOrder}
          className="w-32"
        />
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          id="cat-active"
          checked={activeValue}
          onCheckedChange={(v) => setValue('active', v === true, { shouldValidate: true })}
        />
        <Label htmlFor="cat-active" className="cursor-pointer text-sm">
          {en.admin.categoryActive}
        </Label>
      </div>

      <div className="pt-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting
            ? en.admin.saving
            : isEdit
              ? en.admin.editCategory
              : en.admin.addCategory}
        </Button>
      </div>
    </form>
  )
}
