'use client'

import { customAlphabet } from 'nanoid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/common/FormField'
import { useT } from '@/lib/i18n/Provider'
import type { MarketingConfig } from '@/lib/schemas/config'

// IndexNow key alphabet: alphanumeric only, satisfies /^[a-zA-Z0-9-]{0,128}$/
const generateIndexNowKey = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  32,
)

interface MarketingControlsProps {
  values: MarketingConfig
  onChange: <K extends keyof MarketingConfig>(key: K, value: MarketingConfig[K]) => void
}

export function MarketingControls({ values, onChange }: MarketingControlsProps) {
  const t = useT()

  return (
    <>
      {/* Search Engine Verification */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t.seo.verificationSectionTitle}</h2>
        </div>

        <FormField
          label={t.seo.googleSiteVerificationLabel}
          htmlFor="mc-google-verify"
          help={t.seo.googleSiteVerificationHelp}
        >
          <Input
            id="mc-google-verify"
            value={values.googleSiteVerification}
            onChange={(e) => onChange('googleSiteVerification', e.target.value)}
            placeholder={t.seo.googleSiteVerificationPlaceholder}
            maxLength={200}
          />
        </FormField>

        <FormField
          label={t.seo.bingSiteVerificationLabel}
          htmlFor="mc-bing-verify"
          help={t.seo.bingSiteVerificationHelp}
        >
          <Input
            id="mc-bing-verify"
            value={values.bingSiteVerification}
            onChange={(e) => onChange('bingSiteVerification', e.target.value)}
            placeholder={t.seo.bingSiteVerificationPlaceholder}
            maxLength={200}
          />
        </FormField>

        <FormField
          label={t.seo.customHeadTagsLabel}
          htmlFor="mc-custom-head"
          help={t.seo.customHeadTagsHelp}
        >
          <Textarea
            id="mc-custom-head"
            value={values.customHeadTags}
            onChange={(e) => onChange('customHeadTags', e.target.value)}
            rows={4}
            className="resize-none font-mono text-xs"
            placeholder={t.seo.customHeadTagsPlaceholder}
          />
        </FormField>
      </div>

      {/* Analytics & Tracking */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t.seo.marketingSectionTitle}</h2>
        </div>

        <FormField
          label={t.seo.ga4MeasurementIdLabel}
          htmlFor="mc-ga4"
          help={t.seo.ga4MeasurementIdHelp}
        >
          <Input
            id="mc-ga4"
            value={values.ga4MeasurementId}
            onChange={(e) => onChange('ga4MeasurementId', e.target.value)}
            placeholder="G-XXXXXXXXXX"
            maxLength={32}
          />
        </FormField>

        <FormField label={t.seo.googleAdsIdLabel} htmlFor="mc-gads" help={t.seo.googleAdsIdHelp}>
          <Input
            id="mc-gads"
            value={values.googleAdsId}
            onChange={(e) => onChange('googleAdsId', e.target.value)}
            placeholder="AW-XXXXXXXXXX"
            maxLength={32}
          />
        </FormField>

        <FormField label={t.seo.metaPixelIdLabel} htmlFor="mc-pixel" help={t.seo.metaPixelIdHelp}>
          <Input
            id="mc-pixel"
            value={values.metaPixelId}
            onChange={(e) => onChange('metaPixelId', e.target.value)}
            placeholder="123456789012345"
            maxLength={32}
          />
        </FormField>

        <FormField
          label={t.seo.cookieConsentEnabledLabel}
          htmlFor="mc-cookie-consent"
          help={t.seo.cookieConsentEnabledHelp}
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mc-cookie-consent"
              checked={values.cookieConsentEnabled}
              onChange={(e) => onChange('cookieConsentEnabled', e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border"
            />
          </div>
        </FormField>

        <FormField
          label={t.seo.indexNowKeyLabel}
          htmlFor="mc-indexnow"
          help={t.seo.indexNowKeyHelp}
        >
          <div className="flex items-center gap-2">
            <Input
              id="mc-indexnow"
              value={values.indexNowKey}
              onChange={(e) => onChange('indexNowKey', e.target.value)}
              placeholder="your-indexnow-key"
              maxLength={128}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange('indexNowKey', generateIndexNowKey())}
            >
              {t.seo.indexNowGenerate}
            </Button>
          </div>
        </FormField>
      </div>
    </>
  )
}
