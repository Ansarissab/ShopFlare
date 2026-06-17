'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField } from '@/components/common/FormField'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { useT } from '@/lib/i18n/Provider'
import {
  CURRENCIES,
  LOCALES,
  SHIPPED_LOCALES,
  type LocaleCode,
  RADIUS_PRESETS,
  FONT_PRESETS,
  STYLE_PRESETS,
  DENSITY_PRESETS,
  HERO_STYLES,
  DEFAULT_PRODUCT_PAGE_SIZE,
  MIN_PRODUCT_PAGE_SIZE,
  MAX_PRODUCT_PAGE_SIZE,
} from '@/lib/constants'
import { apiPut, apiUpload, apiDelete } from '@/lib/api'
import { contrastColor } from '@/lib/utils'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { DATA_UPDATED_CHANNEL } from '@/hooks/useApiResource'
import { AnnouncementControls } from './AnnouncementControls'
import { FaqItemsControls } from './FaqItemsControls'
import { MarketingControls } from './MarketingControls'
import { parseFaq } from '@/lib/html'
import type { FaqItemData } from '@/lib/schemas/config'

export default function AdminSettingsPage() {
  const t = useT()
  const { config, loading } = useStoreConfig()

  const [storeName, setStoreName] = useState('')
  const [tagline, setTagline] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [currency, setCurrency] = useState('PKR')
  const [flatShipping, setFlatShipping] = useState('0')
  const [freeThreshold, setFreeThreshold] = useState('0')
  const [bankName, setBankName] = useState('')
  const [bankAccountTitle, setBankAccountTitle] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankIban, setBankIban] = useState('')
  const [bankInstructions, setBankInstructions] = useState('')
  const [productPageSize, setProductPageSize] = useState(String(DEFAULT_PRODUCT_PAGE_SIZE))
  const [saving, setSaving] = useState(false)

  const [primaryColor, setPrimaryColor] = useState('#1A1A18')
  const [accentColor, setAccentColor] = useState('#4A7C6F')
  const [radius, setRadius] = useState('md')
  const [fontFamily, setFontFamily] = useState('sans')
  const [colorMode, setColorMode] = useState('light')
  const [density, setDensity] = useState('comfortable')
  const [heroStyle, setHeroStyle] = useState('image-left')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [faviconUploading, setFaviconUploading] = useState(false)

  // WhatsApp
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)

  // Reviews
  const [reviewsEnabled, setReviewsEnabled] = useState(true)

  // SEO / LLM discovery
  const [llmDiscoveryEnabled, setLlmDiscoveryEnabled] = useState(true)
  const [aiTrainingAllowed, setAiTrainingAllowed] = useState(true)
  const [faqEnabled, setFaqEnabled] = useState(false)
  const [blogEnabled, setBlogEnabled] = useState(false)
  const [faqItems, setFaqItems] = useState<FaqItemData[]>([])

  // Marketing / SEO phase 32
  const [googleSiteVerification, setGoogleSiteVerification] = useState('')
  const [bingSiteVerification, setBingSiteVerification] = useState('')
  const [customHeadTags, setCustomHeadTags] = useState('')
  const [ga4MeasurementId, setGa4MeasurementId] = useState('')
  const [googleAdsId, setGoogleAdsId] = useState('')
  const [metaPixelId, setMetaPixelId] = useState('')
  const [cookieConsentEnabled, setCookieConsentEnabled] = useState(true)
  const [indexNowKey, setIndexNowKey] = useState('')

  // Tax
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRateInput, setTaxRateInput] = useState('0')
  const [taxName, setTaxName] = useState('Tax')
  const [taxInclusive, setTaxInclusive] = useState(false)
  const [taxBasis, setTaxBasis] = useState('subtotal')
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState('')

  // Locales
  const [enabledLocales, setEnabledLocales] = useState<LocaleCode[]>(['en'])
  const [defaultLocale, setDefaultLocale] = useState<LocaleCode>('en')

  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  // One-time seed of editable form fields from the async-loaded config. Must be
  // an effect (config arrives after fetch, then the form stays user-editable, so
  // we can't derive these during render). The setState is intentional seeding,
  // not a render-cascade loop — it runs once per config change.
  useEffect(() => {
    if (!config) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed of editable form state from async-loaded config
    setStoreName(config.storeName)
    setTagline(config.tagline ?? '')
    setWhatsappNumber(config.whatsappNumber ?? '')
    setWhatsappEnabled(config.whatsappEnabled ?? false)
    setReviewsEnabled(config.reviewsEnabled ?? true)
    setLlmDiscoveryEnabled(config.llmDiscoveryEnabled ?? true)
    setAiTrainingAllowed(config.aiTrainingAllowed ?? true)
    setFaqEnabled(config.faqEnabled ?? false)
    setBlogEnabled(config.blogEnabled ?? false)
    // Seed structured FAQ items; migrate legacy faqContent blob when no items stored yet
    const storedItems = config.faqItems ?? []
    if (storedItems.length > 0) {
      setFaqItems(storedItems)
    } else if (config.faqContent) {
      setFaqItems(parseFaq(config.faqContent))
    } else {
      setFaqItems([])
    }
    setGoogleSiteVerification(config.googleSiteVerification ?? '')
    setBingSiteVerification(config.bingSiteVerification ?? '')
    setCustomHeadTags(config.customHeadTags ?? '')
    setGa4MeasurementId(config.ga4MeasurementId ?? '')
    setGoogleAdsId(config.googleAdsId ?? '')
    setMetaPixelId(config.metaPixelId ?? '')
    setCookieConsentEnabled(config.cookieConsentEnabled ?? true)
    setIndexNowKey(config.indexNowKey ?? '')
    setContactEmail(config.contactEmail ?? '')
    setCurrency(config.currency)
    setFlatShipping(String(config.flatShippingRateCents))
    setFreeThreshold(String(config.freeShippingThresholdCents))
    setBankName(config.bankName ?? '')
    setBankAccountTitle(config.bankAccountTitle ?? '')
    setBankAccountNumber(config.bankAccountNumber ?? '')
    setBankIban(config.bankIban ?? '')
    setBankInstructions(config.bankInstructions ?? '')
    setPrimaryColor(config.primaryColor ?? '#1A1A18')
    setAccentColor(config.accentColor ?? '#4A7C6F')
    setRadius(config.radius ?? 'md')
    setFontFamily(config.fontFamily ?? 'sans')
    setColorMode(config.colorMode ?? 'light')
    setDensity(config.density ?? 'comfortable')
    setHeroStyle(config.heroStyle ?? 'image-left')
    setLogoUrl(config.logoUrl ?? '')
    setTaxEnabled(config.taxEnabled ?? false)
    setTaxRateInput(String(config.taxRate ?? 0))
    setTaxName(config.taxName ?? 'Tax')
    setTaxInclusive(config.taxInclusive ?? false)
    setTaxBasis(config.taxBasis ?? 'subtotal')
    setTaxRegistrationNumber(config.taxRegistrationNumber ?? '')
    setProductPageSize(String(config.productPageSize ?? DEFAULT_PRODUCT_PAGE_SIZE))
    const rawEnabled = config.enabledLocales ?? ['en']
    const validEnabled = rawEnabled.filter((l: string) =>
      SHIPPED_LOCALES.includes(l as LocaleCode),
    ) as LocaleCode[]
    setEnabledLocales(validEnabled.length > 0 ? validEnabled : ['en'])
    const rawDefault = config.defaultLocale as LocaleCode | undefined
    setDefaultLocale(rawDefault && SHIPPED_LOCALES.includes(rawDefault) ? rawDefault : 'en')
  }, [config])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { logoUrl: url } = await apiUpload<{ logoUrl: string }>('/api/admin/config/logo', form)
      setLogoUrl(url)
      toast.success(t.admin.logoUploaded)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveLogo() {
    try {
      await apiDelete('/api/admin/config/logo')
      setLogoUrl('')
      toast.success(t.admin.logoRemoved)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(t.errors.networkError)
    }
  }

  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFaviconUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await apiUpload('/api/admin/config/favicon', form)
      toast.success(t.admin.logoUploaded)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setFaviconUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiPut('/api/admin/config/store', {
        storeName: storeName.trim() || undefined,
        tagline: tagline.trim() || undefined,
        whatsappNumber: whatsappNumber.trim() || undefined,
        whatsappEnabled,
        reviewsEnabled,
        llmDiscoveryEnabled,
        aiTrainingAllowed,
        faqEnabled,
        blogEnabled,
        faqItems: faqItems.filter((item) => item.question.trim() && item.answer.trim()),
        googleSiteVerification: googleSiteVerification.trim() || undefined,
        bingSiteVerification: bingSiteVerification.trim() || undefined,
        customHeadTags: customHeadTags.trim() || undefined,
        ga4MeasurementId: ga4MeasurementId.trim() || undefined,
        googleAdsId: googleAdsId.trim() || undefined,
        metaPixelId: metaPixelId.trim() || undefined,
        cookieConsentEnabled,
        indexNowKey: indexNowKey.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        currency,
        flatShippingRateCents: Number(flatShipping),
        freeShippingThresholdCents: Number(freeThreshold),
        // Send trimmed values (incl. empty) so the merchant can CLEAR a field —
        // emptying the account number hides the Bank Transfer option at checkout.
        bankName: bankName.trim(),
        bankAccountTitle: bankAccountTitle.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankIban: bankIban.trim(),
        bankInstructions: bankInstructions.trim(),
        primaryColor: primaryColor || undefined,
        accentColor: accentColor || undefined,
        radius,
        fontFamily,
        colorMode,
        density,
        heroStyle,
        taxEnabled,
        taxRate: Number(taxRateInput) || 0,
        taxName: taxName.trim() || 'Tax',
        taxInclusive,
        taxBasis,
        taxRegistrationNumber: taxRegistrationNumber.trim() || undefined,
        productPageSize: Number(productPageSize) || DEFAULT_PRODUCT_PAGE_SIZE,
        enabledLocales,
        defaultLocale,
      })
      toast.success(t.admin.settingsSaved)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-lg">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <AdminPageHeader
        title={t.admin.storeSettings}
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t.admin.saving : t.admin.save}
          </Button>
        }
      />

      {/* Appearance */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t.admin.appearance}</h2>
          <p className="text-xs text-muted-foreground">{t.admin.appearanceHint}</p>
        </div>

        {/* Style presets — each card sets all appearance fields at once */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t.admin.stylePresets}</span>
          <p className="text-xs text-muted-foreground">{t.admin.stylePresetsHint}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STYLE_PRESETS.map((preset) => {
            const isActive =
              primaryColor === preset.primaryColor &&
              accentColor === preset.accentColor &&
              fontFamily === preset.fontFamily &&
              radius === preset.radius &&
              density === preset.density &&
              heroStyle === preset.heroStyle
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setPrimaryColor(preset.primaryColor)
                  setAccentColor(preset.accentColor)
                  setFontFamily(preset.fontFamily)
                  setRadius(preset.radius)
                  setDensity(preset.density)
                  setHeroStyle(preset.heroStyle)
                }}
                className={`flex flex-col gap-1.5 rounded-lg border p-2.5 text-left text-xs hover:bg-muted transition-colors ${isActive ? 'border-accent ring-1 ring-accent' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-4 w-4 rounded-full border shrink-0"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <span
                    className="inline-block h-4 w-4 rounded-full border shrink-0"
                    style={{ backgroundColor: preset.accentColor }}
                  />
                  <span className="font-medium truncate">{preset.name}</span>
                </div>
                <span className="text-muted-foreground truncate">
                  {preset.fontFamily} · {preset.radius} · {preset.density}
                </span>
              </button>
            )
          })}
        </div>

        {/* Color pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label={t.admin.primaryColor}
            htmlFor="a-primary"
            help={t.tooltips.settings.primaryColor}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="a-primary"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border p-0.5 bg-transparent"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="font-mono text-xs"
                maxLength={7}
                placeholder="#1A1A18"
              />
            </div>
          </FormField>
          <FormField
            label={t.admin.accentColor}
            htmlFor="a-accent"
            help={t.tooltips.settings.accentColor}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="a-accent"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border p-0.5 bg-transparent"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="font-mono text-xs"
                maxLength={7}
                placeholder="#4A7C6F"
              />
            </div>
          </FormField>
        </div>

        {/* Selects: radius / font / color mode */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            label={t.admin.borderRadius}
            htmlFor="a-radius"
            help={t.tooltips.settings.radius}
          >
            <Select value={radius} onValueChange={(v: string | null) => setRadius(v ?? 'md')}>
              <SelectTrigger id="a-radius" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(RADIUS_PRESETS).map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label={t.admin.fontFamily}
            htmlFor="a-font"
            help={t.tooltips.settings.fontFamily}
          >
            <Select
              value={fontFamily}
              onValueChange={(v: string | null) => setFontFamily(v ?? 'sans')}
            >
              <SelectTrigger id="a-font" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(FONT_PRESETS).map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label={t.admin.colorMode}
            htmlFor="a-mode"
            help={t.tooltips.settings.colorMode}
          >
            <Select
              value={colorMode}
              onValueChange={(v: string | null) => setColorMode(v ?? 'light')}
            >
              <SelectTrigger id="a-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t.admin.colorModeLight}</SelectItem>
                <SelectItem value="dark">{t.admin.colorModeDark}</SelectItem>
                <SelectItem value="system">{t.admin.colorModeSystem}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* Selects: density / hero style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label={t.admin.styleDensity}
            htmlFor="a-density"
            help={t.tooltips.settings.density}
          >
            <Select
              value={density}
              onValueChange={(v: string | null) => setDensity(v ?? 'comfortable')}
            >
              <SelectTrigger id="a-density" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(DENSITY_PRESETS).map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label={t.admin.styleHeroStyle}
            htmlFor="a-hero-style"
            help={t.tooltips.settings.heroStyle}
          >
            <Select
              value={heroStyle}
              onValueChange={(v: string | null) => setHeroStyle(v ?? 'image-left')}
            >
              <SelectTrigger id="a-hero-style" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HERO_STYLES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* Live preview — renders the merchant's chosen colors verbatim, so its
            contrast reflects their selection, not a fixed app defect. Excluded
            from the automated a11y contrast gate via data-color-preview. */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{t.admin.livePreview}</span>
          <div className="flex items-center gap-3" data-color-preview>
            <span
              className="px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: primaryColor,
                color: /^#[0-9a-fA-F]{6}$/.test(primaryColor)
                  ? contrastColor(primaryColor)
                  : '#ffffff',
                borderRadius: RADIUS_PRESETS[radius as keyof typeof RADIUS_PRESETS] ?? '0.5rem',
              }}
            >
              {t.admin.previewButton}
            </span>
            <span className="text-xs font-medium" style={{ color: accentColor }}>
              {t.admin.previewAccent}
            </span>
            <span
              className="px-2 py-0.5 text-xs border"
              style={{
                color: accentColor,
                borderColor: accentColor,
                borderRadius: RADIUS_PRESETS[radius as keyof typeof RADIUS_PRESETS] ?? '0.5rem',
              }}
            >
              {t.admin.previewBadge}
            </span>
          </div>
        </div>

        {/* Logo upload */}
        <FormField label={t.admin.logo} htmlFor="a-logo" help={t.tooltips.settings.logo}>
          <div className="flex items-center gap-3">
            {logoUrl && (
              <div className="relative h-10 w-24 shrink-0">
                <Image
                  src={logoUrl}
                  alt={t.admin.logo}
                  fill
                  sizes="96px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              id="a-logo"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logoUploading}
              onClick={() => logoInputRef.current?.click()}
            >
              {logoUploading ? t.admin.saving : t.admin.uploadLogo}
            </Button>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemoveLogo}>
                {t.admin.removeLogo}
              </Button>
            )}
          </div>
        </FormField>

        {/* Favicon upload */}
        <FormField label={t.admin.favicon} htmlFor="a-favicon" help={t.tooltips.settings.favicon}>
          <div className="flex items-center gap-3">
            <input
              ref={faviconInputRef}
              type="file"
              id="a-favicon"
              accept="image/*,.ico"
              className="hidden"
              onChange={handleFaviconUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={faviconUploading}
              onClick={() => faviconInputRef.current?.click()}
            >
              {faviconUploading ? t.admin.saving : t.admin.uploadFavicon}
            </Button>
          </div>
        </FormField>
      </div>

      {/* Tax */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t.admin.taxSettings}</h2>
          <p className="text-xs text-muted-foreground">{t.admin.taxSettingsHint}</p>
        </div>

        {/* Enable toggle */}
        <FormField
          label={t.admin.taxEnabled}
          htmlFor="t-enabled"
          help={t.tooltips.settings.taxEnabled}
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id="t-enabled"
              checked={taxEnabled}
              onCheckedChange={(val) => setTaxEnabled(val === true)}
            />
            <span className="text-xs text-muted-foreground">{t.admin.taxEnabledHint}</span>
          </div>
        </FormField>

        {taxEnabled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label={t.admin.taxName}
                htmlFor="t-name"
                help={t.tooltips.settings.taxName}
              >
                <Input
                  id="t-name"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  placeholder="GST"
                  maxLength={30}
                />
              </FormField>
              <FormField
                label={t.admin.taxRate}
                htmlFor="t-rate"
                help={t.tooltips.settings.taxRate}
              >
                <Input
                  id="t-rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxRateInput}
                  onChange={(e) => setTaxRateInput(e.target.value)}
                  placeholder="17"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label={t.admin.taxBasis}
                htmlFor="t-basis"
                help={t.tooltips.settings.taxBasis}
              >
                <Select
                  value={taxBasis}
                  onValueChange={(v: string | null) => setTaxBasis(v ?? 'subtotal')}
                >
                  <SelectTrigger id="t-basis" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subtotal">{t.admin.taxBasisSubtotal}</SelectItem>
                    <SelectItem value="subtotal_and_shipping">
                      {t.admin.taxBasisSubtotalShipping}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label={t.admin.taxInclusive}
                htmlFor="t-inclusive"
                help={t.tooltips.settings.taxInclusive}
              >
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="t-inclusive"
                    checked={taxInclusive}
                    onCheckedChange={(val) => setTaxInclusive(val === true)}
                  />
                </div>
              </FormField>
            </div>

            <FormField
              label={t.admin.taxRegistrationNumber}
              htmlFor="t-reg"
              help={t.tooltips.settings.taxRegistration}
            >
              <Input
                id="t-reg"
                value={taxRegistrationNumber}
                onChange={(e) => setTaxRegistrationNumber(e.target.value)}
                placeholder="NTN-1234567-8"
                maxLength={50}
              />
            </FormField>

            {/* Live preview */}
            {Number(taxRateInput) > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-xs flex flex-col gap-1">
                <p className="font-medium text-muted-foreground">{t.admin.livePreview}</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.cart.subtotal}</span>
                  <span>5,000</span>
                </div>
                {!taxInclusive && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {taxName} ({taxRateInput}%)
                    </span>
                    <span>{Math.round(5000 * (Number(taxRateInput) / 100)).toLocaleString()}</span>
                  </div>
                )}
                {taxInclusive && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {taxName} {t.admin.taxInclusive.toLowerCase()}
                    </span>
                    <span>
                      {Math.round(5000 - 5000 / (1 + Number(taxRateInput) / 100)).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                  <span>{t.cart.total}</span>
                  <span>
                    {taxInclusive
                      ? '5,000'
                      : (5000 + Math.round(5000 * (Number(taxRateInput) / 100))).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Identity */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">{t.admin.sectionIdentity}</h2>
        <FormField label={t.admin.storeName} htmlFor="s-name">
          <Input id="s-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </FormField>
        <FormField label={t.admin.tagline} htmlFor="s-tagline">
          <Input id="s-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </FormField>
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">{t.admin.sectionContact}</h2>
        <FormField label={t.admin.whatsappNumber} htmlFor="s-wa">
          <Input
            id="s-wa"
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+92300..."
          />
        </FormField>
        <FormField label={t.admin.enableWhatsApp} htmlFor="s-wa-enabled">
          <div className="flex items-center gap-2">
            <Checkbox
              id="s-wa-enabled"
              checked={whatsappEnabled}
              onCheckedChange={(val) => setWhatsappEnabled(val === true)}
            />
            <span className="text-xs text-muted-foreground">{t.admin.enableWhatsAppHint}</span>
          </div>
        </FormField>
        <FormField label={t.admin.enableReviews} htmlFor="s-reviews-enabled">
          <div className="flex items-center gap-2">
            <Checkbox
              id="s-reviews-enabled"
              checked={reviewsEnabled}
              onCheckedChange={(val) => setReviewsEnabled(val === true)}
            />
            <span className="text-xs text-muted-foreground">{t.admin.enableReviewsHint}</span>
          </div>
        </FormField>
        <FormField label={t.admin.contactEmail} htmlFor="s-email">
          <Input
            id="s-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </FormField>
      </div>

      {/* SEO / LLM Discovery */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t.admin.sectionSeoLlm}</h2>
        </div>

        <FormField label={t.seo.llmDiscoveryLabel} htmlFor="s-llm-discovery">
          <div className="flex items-center gap-2">
            <Checkbox
              id="s-llm-discovery"
              checked={llmDiscoveryEnabled}
              onCheckedChange={(val) => setLlmDiscoveryEnabled(val === true)}
            />
            <span className="text-xs text-muted-foreground">{t.seo.llmDiscoveryHelp}</span>
          </div>
        </FormField>

        <FormField label={t.seo.aiTrainingLabel} htmlFor="s-ai-training">
          <div className="flex items-center gap-2">
            <Checkbox
              id="s-ai-training"
              checked={aiTrainingAllowed}
              onCheckedChange={(val) => setAiTrainingAllowed(val === true)}
            />
            <span className="text-xs text-muted-foreground">{t.seo.aiTrainingHelp}</span>
          </div>
        </FormField>

        <FormField label={t.seo.faqEnabledLabel} htmlFor="s-faq-enabled">
          <div className="flex items-center gap-2">
            <Checkbox
              id="s-faq-enabled"
              checked={faqEnabled}
              onCheckedChange={(val) => setFaqEnabled(val === true)}
            />
          </div>
        </FormField>

        {faqEnabled && <FaqItemsControls value={faqItems} onChange={setFaqItems} />}

        <FormField label={t.admin.enableBlog} htmlFor="s-blog-enabled">
          <div className="flex items-center gap-2">
            <Checkbox
              id="s-blog-enabled"
              checked={blogEnabled}
              onCheckedChange={(val) => setBlogEnabled(val === true)}
            />
          </div>
        </FormField>
        <p className="text-sm text-muted-foreground -mt-2">{t.admin.enableBlogHint}</p>
      </div>

      {/* Marketing / SEO — phase 32 */}
      <MarketingControls
        values={{
          googleSiteVerification,
          bingSiteVerification,
          customHeadTags,
          ga4MeasurementId,
          googleAdsId,
          metaPixelId,
          cookieConsentEnabled,
          indexNowKey,
        }}
        onChange={(key, value) => {
          const setters: Record<string, (v: never) => void> = {
            googleSiteVerification: setGoogleSiteVerification,
            bingSiteVerification: setBingSiteVerification,
            customHeadTags: setCustomHeadTags,
            ga4MeasurementId: setGa4MeasurementId,
            googleAdsId: setGoogleAdsId,
            metaPixelId: setMetaPixelId,
            cookieConsentEnabled: setCookieConsentEnabled,
            indexNowKey: setIndexNowKey,
          }
          setters[key]?.(value as never)
        }}
      />

      {/* Languages */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t.admin.localesHeading}</h2>
          <p className="text-xs text-muted-foreground">{t.admin.localesDescription}</p>
        </div>

        <FormField label={t.admin.enabledLocalesLabel} htmlFor="s-locales">
          <div className="flex flex-col gap-2">
            {SHIPPED_LOCALES.map((loc) => {
              const isEn = loc === 'en'
              const checked = isEn || enabledLocales.includes(loc)
              return (
                <label key={loc} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={checked}
                    disabled={isEn}
                    onCheckedChange={(val) => {
                      if (isEn) return
                      if (val === true) {
                        setEnabledLocales((prev) => [...prev, loc])
                      } else {
                        const next = enabledLocales.filter((l) => l !== loc)
                        setEnabledLocales(next)
                        // If the disabled locale was the default, reset to 'en'
                        if (defaultLocale === loc) setDefaultLocale('en')
                      }
                    }}
                  />
                  {LOCALES[loc].label}
                </label>
              )
            })}
          </div>
        </FormField>

        <FormField label={t.admin.defaultLocaleLabel} htmlFor="s-default-locale">
          <Select
            value={defaultLocale}
            onValueChange={(v: string | null) => setDefaultLocale((v as LocaleCode) ?? 'en')}
          >
            <SelectTrigger id="s-default-locale" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {enabledLocales.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {LOCALES[loc].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {/* Announcement Bar */}
      <AnnouncementControls config={config} />

      {/* Payments & Shipping */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">{t.admin.sectionPaymentsShipping}</h2>
        <FormField
          label={t.admin.currency}
          htmlFor="s-currency"
          help={t.tooltips.settings.currency}
        >
          <Select value={currency} onValueChange={(v: string | null) => setCurrency(v ?? 'PKR')}>
            <SelectTrigger id="s-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CURRENCIES).map(([code, info]) => (
                <SelectItem key={code} value={code}>
                  {info.symbol} {info.name} ({code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label={t.admin.flatShippingRate}
          htmlFor="s-flat"
          help={t.tooltips.settings.flatShipping}
        >
          <Input
            id="s-flat"
            type="number"
            min={0}
            value={flatShipping}
            onChange={(e) => setFlatShipping(e.target.value)}
          />
        </FormField>
        <FormField
          label={t.admin.freeShippingThreshold}
          htmlFor="s-threshold"
          help={t.tooltips.settings.freeShipThreshold}
        >
          <Input
            id="s-threshold"
            type="number"
            min={0}
            value={freeThreshold}
            onChange={(e) => setFreeThreshold(e.target.value)}
          />
        </FormField>
        <FormField label={t.admin.productPageSize} htmlFor="s-page-size">
          <Input
            id="s-page-size"
            type="number"
            min={MIN_PRODUCT_PAGE_SIZE}
            max={MAX_PRODUCT_PAGE_SIZE}
            step={6}
            value={productPageSize}
            onChange={(e) => setProductPageSize(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">{t.admin.productPageSizeHint}</p>
        </FormField>
      </div>

      {/* Bank Transfer Details */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t.admin.bankSectionTitle}</h2>
          <p className="text-xs text-muted-foreground">{t.admin.bankSectionHint}</p>
        </div>
        <FormField label={t.admin.bankName} htmlFor="s-bank-name">
          <Input
            id="s-bank-name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Meezan Bank"
          />
        </FormField>
        <FormField label={t.admin.bankAccountTitle} htmlFor="s-bank-title">
          <Input
            id="s-bank-title"
            value={bankAccountTitle}
            onChange={(e) => setBankAccountTitle(e.target.value)}
          />
        </FormField>
        <FormField label={t.admin.bankAccountNumber} htmlFor="s-bank-acct">
          <Input
            id="s-bank-acct"
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
          />
        </FormField>
        <FormField label={t.admin.bankIban} htmlFor="s-bank-iban">
          <Input
            id="s-bank-iban"
            value={bankIban}
            onChange={(e) => setBankIban(e.target.value)}
            placeholder="PK00MEZN..."
          />
        </FormField>
        <FormField label={t.admin.bankInstructions} htmlFor="s-bank-note">
          <Textarea
            id="s-bank-note"
            rows={2}
            value={bankInstructions}
            onChange={(e) => setBankInstructions(e.target.value)}
            className="resize-none"
          />
        </FormField>
      </div>
    </div>
  )
}
