import { en, type Dictionary } from './en'
import { fr } from './fr'
import { ur } from './ur'
import { DEFAULT_LOCALE, SHIPPED_LOCALES, type LocaleCode } from '@/lib/constants'

const DICTIONARIES: Record<LocaleCode, Dictionary> = { en, fr, ur }

export function isLocale(x: string | null | undefined): x is LocaleCode {
  return !!x && (SHIPPED_LOCALES as string[]).includes(x)
}

export function getDictionary(locale: string | null | undefined): Dictionary {
  return isLocale(locale) ? DICTIONARIES[locale] : DICTIONARIES[DEFAULT_LOCALE]
}

export type { Dictionary }
