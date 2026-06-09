import { en } from '@/lib/i18n/en'
import type { FaqItem } from '@/lib/seo/jsonld'

interface Props {
  items: FaqItem[]
}

export function FaqSection({ items }: Props) {
  if (!items.length) return null
  return (
    <section aria-labelledby="faq-heading" className="mt-12 border-t border-border pt-10">
      <h2 id="faq-heading" className="text-xl font-bold tracking-tight text-foreground mb-6">
        {en.seo.faqSectionTitle}
      </h2>
      <dl className="space-y-6">
        {items.map((item, i) => (
          <div key={i}>
            <dt className="font-medium text-foreground">{item.question}</dt>
            <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
