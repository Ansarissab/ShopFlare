'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormField } from '@/components/common/FormField'
import { useT } from '@/lib/i18n/Provider'
import { ANNOUNCEMENT_TYPES, MAX_ANNOUNCEMENT_MESSAGES } from '@/lib/constants'
import { apiPut } from '@/lib/api'
import { DATA_UPDATED_CHANNEL } from '@/hooks/useApiResource'
import type { AnnouncementMessage, AnnouncementConfigData } from '@/lib/schemas'
import type { StoreConfig } from '@/lib/types/common'

// ── Timezone helpers ──────────────────────────────────────────────────────────

/**
 * Convert a UTC ISO string (from D1) to a `datetime-local`-compatible LOCAL
 * string (`YYYY-MM-DDTHH:mm`) so the <input type="datetime-local"> displays it
 * in the admin's local timezone. Returns '' on invalid/empty input.
 */
export function utcIsoToLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/**
 * Convert a `datetime-local` local string (`YYYY-MM-DDTHH:mm`) to a UTC ISO
 * string for storage. Interprets the value as the admin's local time.
 * Returns undefined on empty or invalid input.
 */
export function localInputToUtcIso(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString()
}

interface AnnouncementControlsProps {
  config: StoreConfig | null
}

const EMPTY_MESSAGE: AnnouncementMessage = { text: '', link: undefined, color: undefined }

export function AnnouncementControls({ config }: AnnouncementControlsProps) {
  const t = useT()

  const [enabled, setEnabled] = useState(false)
  const [type, setType] = useState<string>('single')
  const [messages, setMessages] = useState<AnnouncementMessage[]>([{ ...EMPTY_MESSAGE }])
  const [scheduleStart, setScheduleStart] = useState('')
  const [scheduleEnd, setScheduleEnd] = useState('')
  const [saving, setSaving] = useState(false)

  // Seed from config
  useEffect(() => {
    if (!config) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from async config
    setEnabled(config.announcementEnabled ?? false)
    setType(config.announcementType ?? 'single')
    const seeded = config.announcementMessages
    setMessages(seeded && seeded.length > 0 ? seeded : [{ ...EMPTY_MESSAGE }])
    // Stored values are UTC ISO — convert to local for the datetime-local input
    setScheduleStart(config.announcementStart ? utcIsoToLocalInput(config.announcementStart) : '')
    setScheduleEnd(config.announcementEnd ? utcIsoToLocalInput(config.announcementEnd) : '')
  }, [config])

  function addMessage() {
    if (messages.length >= MAX_ANNOUNCEMENT_MESSAGES) return
    setMessages((prev) => [...prev, { ...EMPTY_MESSAGE }])
  }

  function removeMessage(idx: number) {
    setMessages((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateMessage(idx: number, field: keyof AnnouncementMessage, value: string) {
    setMessages((prev) =>
      prev.map((msg, i) => (i === idx ? { ...msg, [field]: value || undefined } : msg)),
    )
  }

  // How many messages to show based on type
  const visibleCount = type === 'rotating' ? MAX_ANNOUNCEMENT_MESSAGES : 1
  const shownMessages = messages.slice(0, visibleCount)

  async function handleSave() {
    setSaving(true)
    try {
      const currentVersion = config?.announcementVersion ?? 0
      const payload: AnnouncementConfigData = {
        announcementEnabled: enabled,
        announcementType: type as AnnouncementConfigData['announcementType'],
        announcementMessages: shownMessages.filter((m) => m.text.trim().length > 0),
        // Convert local datetime-local strings to UTC ISO for storage
        announcementStart: type === 'scheduled' ? localInputToUtcIso(scheduleStart) : undefined,
        announcementEnd: type === 'scheduled' ? localInputToUtcIso(scheduleEnd) : undefined,
        // Bump version on every save so customers who dismissed the old bar see the new one
        announcementVersion: currentVersion + 1,
      }
      await apiPut('/api/admin/config/store', payload)
      toast.success(t.admin.announcementSaved)
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel(DATA_UPDATED_CHANNEL).postMessage('config-updated')
      }
    } catch {
      toast.error(t.errors.networkError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{t.admin.announcementBarHeading}</h2>
          <p className="text-xs text-muted-foreground">{t.admin.announcementBarHint}</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? t.admin.saving : t.admin.saveAnnouncement}
        </Button>
      </div>

      {/* Enable toggle */}
      <FormField label={t.admin.announcementEnabled} htmlFor="ann-enabled">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ann-enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border"
          />
        </div>
      </FormField>

      {enabled && (
        <>
          {/* Type selector */}
          <FormField label={t.admin.announcementType} htmlFor="ann-type">
            <Select value={type} onValueChange={(v: string | null) => setType(v ?? 'single')}>
              <SelectTrigger id="ann-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANNOUNCEMENT_TYPES.map((at) => (
                  <SelectItem key={at} value={at}>
                    {at === 'single'
                      ? t.admin.announcementTypeSingle
                      : at === 'scheduled'
                        ? t.admin.announcementTypeScheduled
                        : t.admin.announcementTypeRotating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Scheduled: start/end datetime inputs */}
          {type === 'scheduled' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t.admin.announcementScheduleStart} htmlFor="ann-start">
                <Input
                  id="ann-start"
                  type="datetime-local"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                />
              </FormField>
              <FormField label={t.admin.announcementScheduleEnd} htmlFor="ann-end">
                <Input
                  id="ann-end"
                  type="datetime-local"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                />
              </FormField>
            </div>
          )}

          {/* Message editor rows */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t.admin.announcementMessages}</span>
            {type === 'rotating' && messages.length < MAX_ANNOUNCEMENT_MESSAGES && (
              <p className="text-xs text-muted-foreground">
                {t.admin.announcementMaxMessages.replace(
                  '{max}',
                  String(MAX_ANNOUNCEMENT_MESSAGES),
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {shownMessages.map((msg, idx) => (
              <div key={idx} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {type === 'rotating' ? `#${idx + 1}` : ''}
                  </span>
                  {type === 'rotating' && shownMessages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMessage(idx)}
                      aria-label={t.admin.announcementRemoveMessage}
                      className="text-destructive hover:opacity-80"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <FormField label={t.admin.announcementMessageText} htmlFor={`ann-text-${idx}`}>
                  <Input
                    id={`ann-text-${idx}`}
                    value={msg.text}
                    onChange={(e) => updateMessage(idx, 'text', e.target.value)}
                    maxLength={200}
                    placeholder="Free shipping on orders above Rs. 3000"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label={t.admin.announcementMessageLink}
                    htmlFor={`ann-link-${idx}`}
                    optional
                  >
                    <Input
                      id={`ann-link-${idx}`}
                      value={msg.link ?? ''}
                      onChange={(e) => updateMessage(idx, 'link', e.target.value)}
                      placeholder="/shop"
                      maxLength={300}
                    />
                  </FormField>

                  <FormField
                    label={t.admin.announcementMessageColor}
                    htmlFor={`ann-color-${idx}`}
                    optional
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id={`ann-color-${idx}`}
                        value={msg.color ?? '#1A1A18'}
                        onChange={(e) => updateMessage(idx, 'color', e.target.value)}
                        className="h-9 w-10 cursor-pointer rounded border p-0.5 bg-transparent"
                      />
                      <Input
                        value={msg.color ?? ''}
                        onChange={(e) => updateMessage(idx, 'color', e.target.value)}
                        className="font-mono text-xs"
                        maxLength={7}
                        placeholder="#1A1A18"
                      />
                    </div>
                  </FormField>
                </div>
              </div>
            ))}
          </div>

          {/* Add message button (rotating only) */}
          {type === 'rotating' && messages.length < MAX_ANNOUNCEMENT_MESSAGES && (
            <Button type="button" variant="outline" size="sm" onClick={addMessage}>
              <Plus className="me-1.5 h-3.5 w-3.5" />
              {t.admin.announcementAddMessage}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
