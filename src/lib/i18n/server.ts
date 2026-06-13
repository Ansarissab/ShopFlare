import { headers } from 'next/headers'
import { DEFAULT_LOCALE, type LocaleCode } from '@/lib/constants'
import { getDictionary, isLocale, type Dictionary } from './index'

export async function getLocale(): Promise<LocaleCode> {
  const l = (await headers()).get('x-locale')
  return isLocale(l) ? l : DEFAULT_LOCALE
}

/** Returns the locale from the x-locale header, or null if the header is absent/invalid.
 *  Distinguishes "explicitly set by middleware" from "fallback to default". */
export async function getLocaleHeader(): Promise<LocaleCode | null> {
  const l = (await headers()).get('x-locale')
  return isLocale(l) ? l : null
}

export async function getT(): Promise<Dictionary> {
  return getDictionary(await getLocale())
}
