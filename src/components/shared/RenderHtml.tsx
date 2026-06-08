import { sanitizeHtml } from '@/lib/html'

interface RenderHtmlProps {
  html: string
  className?: string
}

// Server component. Always sanitizes on render — never trust stored HTML.
export function RenderHtml({ html, className }: RenderHtmlProps) {
  const clean = sanitizeHtml(html)
  return (
    <div
      className={`prose prose-sm max-w-none${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
