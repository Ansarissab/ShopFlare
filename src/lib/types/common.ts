import type * as React from 'react'
import type { CurrencyCode } from '@/lib/constants'
import type { StoreConfigData } from '@/lib/schemas'

/**
 * Visitor's cookie-consent value.
 * - null  — not yet resolved (SSR / pre-hydration). Marketing scripts must NOT
 *           fire until this resolves to true.
 * - true  — visitor accepted cookies for the current CONSENT_VERSION.
 * - false — visitor declined.
 */
export type ConsentValue = boolean | null

export type StoreConfig = Omit<StoreConfigData, 'currency'> & {
  currency: CurrencyCode
}

export type ThemeSnapshot = Pick<
  StoreConfig,
  | 'primaryColor'
  | 'primaryColorFg'
  | 'accentColor'
  | 'accentColorFg'
  | 'radius'
  | 'fontFamily'
  | 'colorMode'
  | 'density'
  | 'heroStyle'
> & {
  logoUrl?: string
}

export interface FieldProps {
  label: string
  htmlFor: string
  optional?: boolean
  error?: string
  /** Optional explanatory tooltip shown beside the label via HelpTip. */
  help?: string
  children: React.ReactNode
}

export interface HelpTipProps {
  text: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
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
