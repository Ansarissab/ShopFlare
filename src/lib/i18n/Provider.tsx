'use client'
import { createContext, useContext } from 'react'
import { DEFAULT_LOCALE, type LocaleCode } from '@/lib/constants'
import { getDictionary, type Dictionary } from './index'

const TContext = createContext<{ t: Dictionary; locale: LocaleCode } | null>(null)

export function TProvider({ locale, children }: { locale: LocaleCode; children: React.ReactNode }) {
  const t = getDictionary(locale)
  return <TContext.Provider value={{ t, locale }}>{children}</TContext.Provider>
}

export function useT(): Dictionary {
  return useContext(TContext)?.t ?? getDictionary(DEFAULT_LOCALE)
}

export function useLocale(): LocaleCode {
  return useContext(TContext)?.locale ?? DEFAULT_LOCALE
}
