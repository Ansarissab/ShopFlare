import { headers } from 'next/headers'
import { DEFAULT_LOCALE, type LocaleCode } from '@/lib/constants'
import { getDictionary, isLocale, type Dictionary } from './index'

export async function getLocale(): Promise<LocaleCode> {
  const l = (await headers()).get('x-locale')
  return isLocale(l) ? l : DEFAULT_LOCALE
}

export async function getT(): Promise<Dictionary> {
  return getDictionary(await getLocale())
}
