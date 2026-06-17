import type { ComponentType } from 'react'
import type { LandingTemplate } from '@/lib/constants'
import type { LandingTemplateProps } from '@/lib/types'
import { ClassicTemplate } from './ClassicTemplate'
import { WiseTemplate } from './WiseTemplate'
import { StripeTemplate } from './StripeTemplate'
import { YcTemplate } from './YcTemplate'

// Single switch point: a landing page renders LANDING_TEMPLATE_REGISTRY[page.template].
// Adding a template = one component + one entry here (the Record is exhaustive over
// LANDING_TEMPLATES, so a new key fails to compile until it's wired).
export const LANDING_TEMPLATE_REGISTRY: Record<
  LandingTemplate,
  ComponentType<LandingTemplateProps>
> = {
  classic: ClassicTemplate,
  wise: WiseTemplate,
  stripe: StripeTemplate,
  yc: YcTemplate,
}
