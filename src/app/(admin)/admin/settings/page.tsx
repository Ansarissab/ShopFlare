'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/common/FormField'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { RichText } from '@/components/shared/RichText'
import { en } from '@/lib/i18n/en'
import { CURRENCIES, RADIUS_PRESETS, FONT_PRESETS, STYLE_PRESETS, DENSITY_PRESETS, HERO_STYLES, DEFAULT_PRODUCT_PAGE_SIZE, MIN_PRODUCT_PAGE_SIZE, MAX_PRODUCT_PAGE_SIZE } from '@/lib/constants'
import { apiPut, apiUpload, apiDelete } from '@/lib/api'
import { contrastColor } from '@/lib/utils'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { DATA_UPDATED_CHANNEL } from '@/hooks/useApiResource'

export default function AdminSettingsPage() {
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

  const [primaryColor, setPrimaryColor] = useState('#18181b')
  const [accentColor, setAccentColor] = useState('#6366f1')
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
  const [faqContent, setFaqContent] = useState('')

  // Tax
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRateInput, setTaxRateInput] = useState('0')
  const [taxName, setTaxName] = useState('Tax')
  const [taxInclusive, setTaxInclusive] = useState(false)
  const [taxBasis, setTaxBasis] = useState('subtotal')
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState('')
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
    setFaqContent(config.faqContent ?? '')
    setContactEmail(config.contactEmail ?? '')
    setCurrency(config.currency)
    setFlatShipping(String(config.flatShippingRateCents))
    setFreeThreshold(String(config.freeShippingThresholdCents))
    setBankName(config.bankName ?? '')
    setBankAccountTitle(config.bankAccountTitle ?? '')
    setBankAccountNumber(config.bankAccountNumber ?? '')
    setBankIban(config.bankIban ?? '')
    setBankInstructions(config.bankInstructions ?? '')
    setPrimaryColor(config.primaryColor ?? '#18181b')
    setAccentColor(config.accentColor ?? '#6366f1')
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
      toast.success(en.admin.logoUploaded)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(en.errors.networkError)
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveLogo() {
    try {
      await apiDelete('/api/admin/config/logo')
      setLogoUrl('')
      toast.success(en.admin.logoRemoved)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(en.errors.networkError)
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
      toast.success(en.admin.logoUploaded)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(en.errors.networkError)
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
        faqContent: faqContent.trim() || undefined,
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
        taxRate:               Number(taxRateInput) || 0,
        taxName:               taxName.trim() || 'Tax',
        taxInclusive,
        taxBasis,
        taxRegistrationNumber: taxRegistrationNumber.trim() || undefined,
        productPageSize: Number(productPageSize) || DEFAULT_PRODUCT_PAGE_SIZE,
      })
      toast.success(en.admin.settingsSaved)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(en.errors.networkError)
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
        title={en.admin.storeSettings}
        actions={<Button onClick={handleSave} disabled={saving}>{saving ? en.admin.saving : en.admin.save}</Button>}
      />

      {/* Appearance */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{en.admin.appearance}</h2>
          <p className="text-xs text-muted-foreground">{en.admin.appearanceHint}</p>
        </div>

        {/* Style presets — each card sets all appearance fields at once */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{en.admin.stylePresets}</span>
          <p className="text-xs text-muted-foreground">{en.admin.stylePresetsHint}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STYLE_PRESETS.map((preset) => {
            const isActive =
              primaryColor === preset.primaryColor &&
              accentColor  === preset.accentColor  &&
              fontFamily   === preset.fontFamily   &&
              radius       === preset.radius       &&
              density      === preset.density      &&
              heroStyle    === preset.heroStyle
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
          <FormField label={en.admin.primaryColor} htmlFor="a-primary" help={en.tooltips.settings.primaryColor}>
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
                placeholder="#18181b"
              />
            </div>
          </FormField>
          <FormField label={en.admin.accentColor} htmlFor="a-accent" help={en.tooltips.settings.accentColor}>
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
                placeholder="#6366f1"
              />
            </div>
          </FormField>
        </div>

        {/* Selects: radius / font / color mode */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label={en.admin.borderRadius} htmlFor="a-radius" help={en.tooltips.settings.radius}>
            <Select value={radius} onValueChange={(v: string | null) => setRadius(v ?? 'md')}>
              <SelectTrigger id="a-radius" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(RADIUS_PRESETS).map((key) => (
                  <SelectItem key={key} value={key}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={en.admin.fontFamily} htmlFor="a-font" help={en.tooltips.settings.fontFamily}>
            <Select value={fontFamily} onValueChange={(v: string | null) => setFontFamily(v ?? 'sans')}>
              <SelectTrigger id="a-font" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(FONT_PRESETS).map((key) => (
                  <SelectItem key={key} value={key}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={en.admin.colorMode} htmlFor="a-mode" help={en.tooltips.settings.colorMode}>
            <Select value={colorMode} onValueChange={(v: string | null) => setColorMode(v ?? 'light')}>
              <SelectTrigger id="a-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{en.admin.colorModeLight}</SelectItem>
                <SelectItem value="dark">{en.admin.colorModeDark}</SelectItem>
                <SelectItem value="system">{en.admin.colorModeSystem}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* Selects: density / hero style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={en.admin.styleDensity} htmlFor="a-density" help={en.tooltips.settings.density}>
            <Select value={density} onValueChange={(v: string | null) => setDensity(v ?? 'comfortable')}>
              <SelectTrigger id="a-density" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(DENSITY_PRESETS).map((key) => (
                  <SelectItem key={key} value={key}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={en.admin.styleHeroStyle} htmlFor="a-hero-style" help={en.tooltips.settings.heroStyle}>
            <Select value={heroStyle} onValueChange={(v: string | null) => setHeroStyle(v ?? 'image-left')}>
              <SelectTrigger id="a-hero-style" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HERO_STYLES.map((key) => (
                  <SelectItem key={key} value={key}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* Live preview — renders the merchant's chosen colors verbatim, so its
            contrast reflects their selection, not a fixed app defect. Excluded
            from the automated a11y contrast gate via data-color-preview. */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{en.admin.livePreview}</span>
          <div className="flex items-center gap-3" data-color-preview>
            <span
              className="px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: primaryColor,
                color: /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? contrastColor(primaryColor) : '#ffffff',
                borderRadius: RADIUS_PRESETS[radius as keyof typeof RADIUS_PRESETS] ?? '0.5rem',
              }}
            >
              Button
            </span>
            <span className="text-xs font-medium" style={{ color: accentColor }}>Accent</span>
            <span
              className="px-2 py-0.5 text-xs border"
              style={{
                color: accentColor,
                borderColor: accentColor,
                borderRadius: RADIUS_PRESETS[radius as keyof typeof RADIUS_PRESETS] ?? '0.5rem',
              }}
            >
              Badge
            </span>
          </div>
        </div>

        {/* Logo upload */}
        <FormField label={en.admin.logo} htmlFor="a-logo" help={en.tooltips.settings.logo}>
          <div className="flex items-center gap-3">
            {logoUrl && (
              <div className="relative h-10 w-24 shrink-0">
                <Image src={logoUrl} alt="Logo" fill sizes="96px" className="object-contain" unoptimized />
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
              {logoUploading ? en.admin.saving : en.admin.uploadLogo}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveLogo}
              >
                {en.admin.removeLogo}
              </Button>
            )}
          </div>
        </FormField>

        {/* Favicon upload */}
        <FormField label={en.admin.favicon} htmlFor="a-favicon" help={en.tooltips.settings.favicon}>
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
              {faviconUploading ? en.admin.saving : en.admin.uploadFavicon}
            </Button>
          </div>
        </FormField>
      </div>

      {/* Tax */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{en.admin.taxSettings}</h2>
          <p className="text-xs text-muted-foreground">{en.admin.taxSettingsHint}</p>
        </div>

        {/* Enable toggle */}
        <FormField label={en.admin.taxEnabled} htmlFor="t-enabled" help={en.tooltips.settings.taxEnabled}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="t-enabled"
              checked={taxEnabled}
              onChange={(e) => setTaxEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">{en.admin.taxEnabledHint}</span>
          </div>
        </FormField>

        {taxEnabled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={en.admin.taxName} htmlFor="t-name" help={en.tooltips.settings.taxName}>
                <Input
                  id="t-name"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  placeholder="GST"
                  maxLength={30}
                />
              </FormField>
              <FormField label={en.admin.taxRate} htmlFor="t-rate" help={en.tooltips.settings.taxRate}>
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
              <FormField label={en.admin.taxBasis} htmlFor="t-basis" help={en.tooltips.settings.taxBasis}>
                <Select value={taxBasis} onValueChange={(v: string | null) => setTaxBasis(v ?? 'subtotal')}>
                  <SelectTrigger id="t-basis" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subtotal">{en.admin.taxBasisSubtotal}</SelectItem>
                    <SelectItem value="subtotal_and_shipping">{en.admin.taxBasisSubtotalShipping}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={en.admin.taxInclusive} htmlFor="t-inclusive" help={en.tooltips.settings.taxInclusive}>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="t-inclusive"
                    checked={taxInclusive}
                    onChange={(e) => setTaxInclusive(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border"
                  />
                </div>
              </FormField>
            </div>

            <FormField label={en.admin.taxRegistrationNumber} htmlFor="t-reg" help={en.tooltips.settings.taxRegistration}>
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
                <p className="font-medium text-muted-foreground">{en.admin.livePreview}</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{en.cart.subtotal}</span>
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
                    <span>{taxName} {en.admin.taxInclusive.toLowerCase()}</span>
                    <span>{Math.round(5000 - 5000 / (1 + Number(taxRateInput) / 100)).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                  <span>{en.cart.total}</span>
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
        <h2 className="text-sm font-semibold">Identity</h2>
        <FormField label={en.admin.storeName} htmlFor="s-name">
          <Input id="s-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </FormField>
        <FormField label={en.admin.tagline} htmlFor="s-tagline">
          <Input id="s-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </FormField>
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Contact</h2>
        <FormField label={en.admin.whatsappNumber} htmlFor="s-wa">
          <Input id="s-wa" type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+92300..." />
        </FormField>
        <FormField label={en.admin.enableWhatsApp} htmlFor="s-wa-enabled">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="s-wa-enabled"
              checked={whatsappEnabled}
              onChange={(e) => setWhatsappEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">{en.admin.enableWhatsAppHint}</span>
          </div>
        </FormField>
        <FormField label={en.admin.enableReviews} htmlFor="s-reviews-enabled">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="s-reviews-enabled"
              checked={reviewsEnabled}
              onChange={(e) => setReviewsEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">{en.admin.enableReviewsHint}</span>
          </div>
        </FormField>
        <FormField label={en.admin.contactEmail} htmlFor="s-email">
          <Input id="s-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </FormField>
      </div>

      {/* SEO / LLM Discovery */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">SEO / LLM Discovery</h2>
        </div>

        <FormField label={en.seo.llmDiscoveryLabel} htmlFor="s-llm-discovery">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="s-llm-discovery"
              checked={llmDiscoveryEnabled}
              onChange={(e) => setLlmDiscoveryEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">{en.seo.llmDiscoveryHelp}</span>
          </div>
        </FormField>

        <FormField label={en.seo.aiTrainingLabel} htmlFor="s-ai-training">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="s-ai-training"
              checked={aiTrainingAllowed}
              onChange={(e) => setAiTrainingAllowed(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">{en.seo.aiTrainingHelp}</span>
          </div>
        </FormField>

        <FormField label={en.seo.faqEnabledLabel} htmlFor="s-faq-enabled">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="s-faq-enabled"
              checked={faqEnabled}
              onChange={(e) => setFaqEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border"
            />
          </div>
        </FormField>

        {faqEnabled && (
          <FormField label={en.seo.faqContentLabel} htmlFor="s-faq-content">
            <p className="text-xs text-muted-foreground mb-2">{en.seo.faqContentHelp}</p>
            <RichText
              value={faqContent}
              onChange={setFaqContent}
            />
          </FormField>
        )}

        <FormField label={en.admin.enableBlog} htmlFor="s-blog-enabled">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="s-blog-enabled"
              checked={blogEnabled}
              onChange={(e) => setBlogEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
          </div>
        </FormField>
        <p className="text-sm text-muted-foreground -mt-2">{en.admin.enableBlogHint}</p>
      </div>

      {/* Payments & Shipping */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Payments &amp; Shipping</h2>
        <FormField label={en.admin.currency} htmlFor="s-currency" help={en.tooltips.settings.currency}>
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
        <FormField label={en.admin.flatShippingRate} htmlFor="s-flat" help={en.tooltips.settings.flatShipping}>
          <Input id="s-flat" type="number" min={0} value={flatShipping} onChange={(e) => setFlatShipping(e.target.value)} />
        </FormField>
        <FormField label={en.admin.freeShippingThreshold} htmlFor="s-threshold" help={en.tooltips.settings.freeShipThreshold}>
          <Input id="s-threshold" type="number" min={0} value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} />
        </FormField>
        <FormField label={en.admin.productPageSize} htmlFor="s-page-size">
          <Input
            id="s-page-size"
            type="number"
            min={MIN_PRODUCT_PAGE_SIZE}
            max={MAX_PRODUCT_PAGE_SIZE}
            step={6}
            value={productPageSize}
            onChange={(e) => setProductPageSize(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">{en.admin.productPageSizeHint}</p>
        </FormField>
      </div>

      {/* Bank Transfer Details */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{en.admin.bankSectionTitle}</h2>
          <p className="text-xs text-muted-foreground">{en.admin.bankSectionHint}</p>
        </div>
        <FormField label={en.admin.bankName} htmlFor="s-bank-name">
          <Input id="s-bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Meezan Bank" />
        </FormField>
        <FormField label={en.admin.bankAccountTitle} htmlFor="s-bank-title">
          <Input id="s-bank-title" value={bankAccountTitle} onChange={(e) => setBankAccountTitle(e.target.value)} />
        </FormField>
        <FormField label={en.admin.bankAccountNumber} htmlFor="s-bank-acct">
          <Input id="s-bank-acct" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
        </FormField>
        <FormField label={en.admin.bankIban} htmlFor="s-bank-iban">
          <Input id="s-bank-iban" value={bankIban} onChange={(e) => setBankIban(e.target.value)} placeholder="PK00MEZN..." />
        </FormField>
        <FormField label={en.admin.bankInstructions} htmlFor="s-bank-note">
          <Textarea id="s-bank-note" rows={2} value={bankInstructions} onChange={(e) => setBankInstructions(e.target.value)} className="resize-none" />
        </FormField>
      </div>

    </div>
  )
}
