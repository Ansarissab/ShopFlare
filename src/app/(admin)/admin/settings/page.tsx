'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { FormField } from '@/components/common/FormField'
import { Skeleton } from '@/components/ui/skeleton'
import { en } from '@/lib/i18n/en'
import { CURRENCIES } from '@/lib/constants'
import { apiPut } from '@/lib/api'
import { useStoreConfig, CONFIG_BROADCAST_CHANNEL } from '@/hooks/useStoreConfig'

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
  }, [config])

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
      })
      toast.success(en.admin.settingsSaved)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(CONFIG_BROADCAST_CHANNEL).postMessage('config-updated')
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
      <h1 className="text-2xl font-bold tracking-tight">{en.admin.storeSettings}</h1>

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

      <Separator />

      <Button onClick={handleSave} disabled={saving} className="w-fit">
        {saving ? en.admin.saving : en.admin.save}
      </Button>
    </div>
  )
}
