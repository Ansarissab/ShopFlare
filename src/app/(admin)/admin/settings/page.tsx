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
import { en } from '@/lib/i18n/en'
import { CURRENCIES, RADIUS_PRESETS, FONT_PRESETS, THEME_PRESETS } from '@/lib/constants'
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
  const [saving, setSaving] = useState(false)

  const [primaryColor, setPrimaryColor] = useState('#18181b')
  const [accentColor, setAccentColor] = useState('#6366f1')
  const [radius, setRadius] = useState('md')
  const [fontFamily, setFontFamily] = useState('sans')
  const [colorMode, setColorMode] = useState('light')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [faviconUploading, setFaviconUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!config) return
    setStoreName(config.storeName)
    setTagline(config.tagline ?? '')
    setWhatsappNumber(config.whatsappNumber ?? '')
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
    setLogoUrl(config.logoUrl ?? '')
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

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => { setPrimaryColor(preset.primaryColor); setAccentColor(preset.accentColor) }}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
            >
              <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: preset.primaryColor }} />
              <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: preset.accentColor }} />
              {preset.name}
            </button>
          ))}
        </div>

        {/* Color pickers */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label={en.admin.primaryColor} htmlFor="a-primary">
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
          <FormField label={en.admin.accentColor} htmlFor="a-accent">
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
        <div className="grid grid-cols-3 gap-4">
          <FormField label={en.admin.borderRadius} htmlFor="a-radius">
            <Select value={radius} onValueChange={(v) => setRadius(v ?? 'md')}>
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
          <FormField label={en.admin.fontFamily} htmlFor="a-font">
            <Select value={fontFamily} onValueChange={(v) => setFontFamily(v ?? 'sans')}>
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
          <FormField label={en.admin.colorMode} htmlFor="a-mode">
            <Select value={colorMode} onValueChange={(v) => setColorMode(v ?? 'light')}>
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

        {/* Live preview */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">{en.admin.livePreview}</span>
          <div className="flex items-center gap-3">
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
        <FormField label={en.admin.logo} htmlFor="a-logo">
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
        <FormField label={en.admin.favicon} htmlFor="a-favicon">
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
        <FormField label={en.admin.contactEmail} htmlFor="s-email">
          <Input id="s-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </FormField>
      </div>

      {/* Payments & Shipping */}
      <div className="flex flex-col gap-4 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Payments &amp; Shipping</h2>
        <FormField label={en.admin.currency} htmlFor="s-currency">
          <Select value={currency} onValueChange={(v) => setCurrency(v ?? 'PKR')}>
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
        <FormField label={en.admin.flatShippingRate} htmlFor="s-flat">
          <Input id="s-flat" type="number" min={0} value={flatShipping} onChange={(e) => setFlatShipping(e.target.value)} />
        </FormField>
        <FormField label={en.admin.freeShippingThreshold} htmlFor="s-threshold">
          <Input id="s-threshold" type="number" min={0} value={freeThreshold} onChange={(e) => setFreeThreshold(e.target.value)} />
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
