'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT } from '@/lib/i18n/Provider'
import type { CategoryNavProps } from '@/lib/types/category'

export function CategoryNav({ categories }: CategoryNavProps) {
  const t = useT()
  if (categories.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none" />
        }
      >
        {t.store.browseCategories}
        <ChevronDown className="h-4 w-4 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-45">
        {categories.map((cat) =>
          cat.children && cat.children.length > 0 ? (
            <DropdownMenuSub key={cat.id}>
              <DropdownMenuSubTrigger>
                <Link
                  href={`/category/${cat.slug}`}
                  prefetch={false}
                  className="flex-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {cat.name}
                </Link>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {/* Parent link at top of sub-menu */}
                <DropdownMenuItem>
                  <Link
                    href={`/category/${cat.slug}`}
                    prefetch={false}
                    className="w-full font-medium"
                  >
                    {cat.name}
                  </Link>
                </DropdownMenuItem>
                {cat.children.map((child) => (
                  <DropdownMenuItem key={child.id}>
                    <Link href={`/category/${child.slug}`} prefetch={false} className="w-full ps-2">
                      {child.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem key={cat.id}>
              <Link href={`/category/${cat.slug}`} prefetch={false} className="w-full">
                {cat.name}
              </Link>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
