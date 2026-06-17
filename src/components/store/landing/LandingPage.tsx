import type { LandingPageProps } from '@/lib/types'
import { LANDING_TEMPLATE_REGISTRY } from './templates/registry'
import { ClassicTemplate } from './templates/ClassicTemplate'

export function LandingPage({ landing, storeConfig, t }: LandingPageProps) {
  const template = landing.template ?? 'classic'
  const Template = LANDING_TEMPLATE_REGISTRY[template] ?? ClassicTemplate
  return <Template landing={landing} storeConfig={storeConfig} t={t} />
}
