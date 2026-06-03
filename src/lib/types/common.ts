import type * as React from 'react'
import type { CurrencyCode } from '@/lib/constants'
import type { StoreConfigData } from '@/lib/schemas'

export type StoreConfig = Omit<StoreConfigData, 'currency'> & {
  currency: CurrencyCode
}

export type ThemeSnapshot = Pick<StoreConfig,
  'primaryColor' | 'primaryColorFg' | 'accentColor' | 'accentColorFg' |
  'radius' | 'fontFamily' | 'colorMode'> & {
  logoUrl?: string
}

export interface FieldProps {
  label: string
  htmlFor: string
  optional?: boolean
  error?: string
  children: React.ReactNode
}

export interface ApiResourceState<T> {
  data: T | null
  loading: boolean
  error: string | null
  notFound: boolean
}

export interface UseStoreConfigResult {
  config: StoreConfig | null
  loading: boolean
  error: string | null
}

export interface PublicConfigResponse {
  vapidPublicKey: string
  stripePublishableKey: string
  turnstileSiteKey: string
}

export interface UsePushSubscriptionReturn {
  supported: boolean
  permission: NotificationPermission
  enabled: boolean
  enable: () => Promise<boolean>
  loading: boolean
}
