'use client'

import dynamic from 'next/dynamic'

export interface RichTextProps {
  value: string
  onChange: (html: string) => void
  /** Admin upload endpoint for inline image attachments → R2 */
  uploadEndpoint?: string
}

// SSR-safe: trix registers custom elements which requires browser DOM.
// Loading placeholder prevents layout shift during the dynamic import.
const RichTextEditor = dynamic(
  () => import('./RichTextEditor').then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[200px] w-full animate-pulse rounded-md border bg-muted" />
    ),
  },
)

export function RichText(props: RichTextProps) {
  return <RichTextEditor {...props} />
}
