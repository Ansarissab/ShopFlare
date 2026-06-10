'use client'

// Trix is browser-only — loaded by next/dynamic from RichText.tsx (ssr: false).
import 'trix/dist/trix.css'
import 'trix'

import { useEffect, useLayoutEffect, useRef, useId } from 'react'
import { toast } from 'sonner'
import { compressImage } from '@/lib/image'
import { apiUpload } from '@/lib/api'
import { en } from '@/lib/i18n/en'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  uploadEndpoint?: string
}

export function RichTextEditor({ value, onChange, uploadEndpoint }: RichTextEditorProps) {
  const uid = useId().replace(/:/g, '')
  const inputId = `trix-input-${uid}`
  const editorRef = useRef<TrixEditorElement | null>(null)
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })

  // Sync value into editor when it changes externally (e.g. form reset).
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (el.value !== value) {
      el.editor?.loadJSON(JSON.parse(value || '{}') as unknown)
    }
  }, [value])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return

    function handleChange() {
      const html = (el?.value ?? '').replace(
        /<action-text-attachment[^>]*>[\s\S]*?<\/action-text-attachment>/g,
        '',
      )
      onChangeRef.current(el?.innerHTML ?? html)
    }

    function handleAttachmentAdd(e: Event) {
      const event = e as TrixAttachmentEvent
      const attachment = event.attachment
      if (!attachment.file || !uploadEndpoint) return

      // Prevent default base64 data-URI embedding.
      e.preventDefault()

      compressImage(attachment.file)
        .then(({ file }) => {
          const form = new FormData()
          form.append('file', file, attachment.file!.name)
          return apiUpload<{ url: string }>(uploadEndpoint, form)
        })
        .then(({ url }) => {
          attachment.setAttributes({ url, href: url })
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : en.errors.networkError)
        })
    }

    el.addEventListener('trix-change', handleChange)
    el.addEventListener('trix-attachment-add', handleAttachmentAdd)
    return () => {
      el.removeEventListener('trix-change', handleChange)
      el.removeEventListener('trix-attachment-add', handleAttachmentAdd)
    }
  }, [uploadEndpoint])

  return (
    <div className="trix-wrapper">
      <input id={inputId} type="hidden" defaultValue={value} />
      <trix-editor
        ref={editorRef as React.RefObject<TrixEditorElement>}
        input={inputId}
        className="trix-content border rounded-md p-2 min-h-[200px] focus:outline-none"
      />
    </div>
  )
}
