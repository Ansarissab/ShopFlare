'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichText } from '@/components/shared/RichText'
import { FormField } from '@/components/common/FormField'
import { useT } from '@/lib/i18n/Provider'
import type { FaqItemData } from '@/lib/schemas/config'

const MAX_FAQ_ITEMS = 50

interface FaqItemsControlsProps {
  value: FaqItemData[]
  onChange: (items: FaqItemData[]) => void
}

export function FaqItemsControls({ value, onChange }: FaqItemsControlsProps) {
  const t = useT()

  function addItem() {
    if (value.length >= MAX_FAQ_ITEMS) return
    onChange([...value, { question: '', answer: '' }])
  }

  function removeItem(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof FaqItemData, val: string) {
    onChange(value.map((item, i) => (i === idx ? { ...item, [field]: val } : item)))
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...value]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  function moveDown(idx: number) {
    if (idx === value.length - 1) return
    const next = [...value]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t.admin.faqItemsHelp}</p>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t.admin.faqEmptyState}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {value.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-2 rounded-md border p-3">
              {/* Row header: index + reorder + remove */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    aria-label={t.admin.faqMoveUp}
                    className="text-muted-foreground hover:opacity-80 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={idx === value.length - 1}
                    aria-label={t.admin.faqMoveDown}
                    className="text-muted-foreground hover:opacity-80 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    aria-label={t.admin.faqRemoveItem}
                    className="text-destructive hover:opacity-80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <FormField label={t.admin.faqQuestionLabel} htmlFor={`faq-q-${idx}`}>
                <Input
                  id={`faq-q-${idx}`}
                  value={item.question}
                  onChange={(e) => updateItem(idx, 'question', e.target.value)}
                  maxLength={300}
                />
              </FormField>

              <FormField label={t.admin.faqAnswerLabel} htmlFor={`faq-a-${idx}`}>
                <RichText
                  value={item.answer}
                  onChange={(html) => updateItem(idx, 'answer', html)}
                />
              </FormField>
            </div>
          ))}
        </div>
      )}

      {value.length < MAX_FAQ_ITEMS && (
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="me-1.5 h-3.5 w-3.5" />
          {t.admin.faqAddItem}
        </Button>
      )}
    </div>
  )
}
