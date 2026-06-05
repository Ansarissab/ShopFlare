'use client'

import { ChevronUp, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { en } from '@/lib/i18n/en'
import { cn } from '@/lib/utils'
import type { CategoryTreeProps, CategoryNode } from '@/lib/types/category'
import type { Category } from '@/lib/types/category'

function CategoryRow({
  node,
  depth,
  onReorder,
  onEdit,
  onDelete,
}: {
  node: CategoryNode
  depth: number
  onReorder: CategoryTreeProps['onReorder']
  onEdit: CategoryTreeProps['onEdit']
  onDelete: CategoryTreeProps['onDelete']
}) {
  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between rounded-md border bg-card px-3 py-2.5',
          !node.active && 'opacity-60',
        )}
        style={{ marginLeft: depth * 20 }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn('text-sm font-medium truncate', !node.active && 'text-muted-foreground')}>
            {node.name}
          </span>
          <Badge variant={node.active ? 'default' : 'secondary'} className="shrink-0">
            {node.active ? en.admin.active : en.admin.inactive}
          </Badge>
          <Badge variant="outline" className="shrink-0 text-xs">
            {node.productCount} {node.productCount === 1 ? 'product' : 'products'}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onReorder(node.id, 'up')}
            aria-label="Move up"
          >
            <ChevronUp className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onReorder(node.id, 'down')}
            aria-label="Move down"
          >
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(node as Category)}
            aria-label={en.admin.editCategory}
          >
            <Pencil className="size-3.5 mr-1" aria-hidden />
            {en.admin.editCategory}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(node.id)}
            aria-label={en.admin.deleteCategory}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {node.children.map((child) => (
        <CategoryRow
          key={child.id}
          node={child}
          depth={depth + 1}
          onReorder={onReorder}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

export function CategoryTree({ categories, onReorder, onEdit, onDelete }: CategoryTreeProps) {
  if (categories.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {en.admin.noCategories}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {categories.map((node) => (
        <CategoryRow
          key={node.id}
          node={node}
          depth={0}
          onReorder={onReorder}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
