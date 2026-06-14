'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT, useLocale } from '@/lib/i18n/Provider'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { LOCALES, SHIPPED_LOCALES, DEFAULT_LOCALE, type LocaleCode } from '@/lib/constants'

export function LocaleSwitcher() {
  const t = useT()
  const currentLocale = useLocale()
  const { config } = useStoreConfig()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawEnabled: string[] = config?.enabledLocales ?? ['en']
  const enabledLocales = rawEnabled.filter((l): l is LocaleCode =>
    SHIPPED_LOCALES.includes(l as LocaleCode),
  )

  // Only render when more than one locale is enabled
  if (enabledLocales.length <= 1) return null

  function navigate(target: LocaleCode) {
    if (target === currentLocale) return

    // Strip any existing /{locale} prefix from the current pathname
    const localePrefix = new RegExp('^/(' + SHIPPED_LOCALES.join('|') + ')(?=/|$)')
    const barePath = pathname.replace(localePrefix, '') || '/'

    // DEFAULT_LOCALE is served unprefixed; all others get a /{locale} prefix.
    // This matches middleware's resolution model (URL prefix determines locale,
    // and the unprefixed path is always the default locale).
    const newPath = target === DEFAULT_LOCALE ? barePath : `/${target}${barePath}`
    const qs = searchParams.toString()
    const newUrl = qs ? `${newPath}?${qs}` : newPath

    // Set cookie client-side so middleware picks it up on the next unprefixed request
    const secure = location.protocol === 'https:' ? 'secure; ' : ''
    document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=31536000; samesite=lax; ${secure}`

    // Hard navigation re-runs middleware + SSR so the dictionary and dir attribute update
    window.location.assign(newUrl)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label={t.store.languageSwitcherLabel}
            className="inline-flex items-center justify-center rounded-md h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none"
          />
        }
      >
        <Globe className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {enabledLocales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => navigate(loc)}
            className={loc === currentLocale ? 'font-medium' : ''}
            aria-current={loc === currentLocale ? 'true' : undefined}
          >
            {LOCALES[loc].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
